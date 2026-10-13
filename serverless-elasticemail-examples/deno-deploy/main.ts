import axios from "npm:axios@1.18.1";
import { Configuration, EmailsApi } from "npm:@elasticemail/elasticemail-client-ts-axios@4.4.0";

const apiKey = Deno.env.get("ELASTICEMAIL_API_KEY");
if (!apiKey) {
  throw new Error("ELASTICEMAIL_API_KEY is not set. Add it in the Deno Deploy project settings or .env");
}
const from = Deno.env.get("EMAIL_FROM") || "Acme <hello@yourdomain.com>";
const secret = Deno.env.get("ELASTICEMAIL_WEBHOOK_TOKEN") || "change_me";

// Deno has no node:http client for axios, so route requests through fetch.
const emailsApi = new EmailsApi(new Configuration({ apiKey }), undefined, axios.create({ adapter: "fetch" }));

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time string compare */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/**
 * Verify an Elastic Email webhook signature with WebCrypto (no node:crypto needed):
 * X-ElasticEmail-Signature: v1=hex(HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${target}\n${rawBody}`)),
 * where target is the path + query exactly as requested (still URL-encoded).
 */
async function verifySignature(
  key: string,
  timestamp: string | null,
  signatureHeader: string | null,
  method: string,
  target: string,
  body: string,
): Promise<boolean> {
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const encoder = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(`${timestamp}\n${method}\n${target}\n${body}`));
  const expected = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return (signatureHeader ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .some((part) => safeEqual(part.slice(3), expected));
}

const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

/** Elastic Email webhooks are form-encoded; JSON is accepted too. */
async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return await req.json();
  if (type.includes("form")) {
    const out: Record<string, string> = {};
    (await req.formData()).forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  }
  return {};
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "GET" && path === "/health") {
    return json({ status: "ok" });
  }

  if (req.method === "POST" && path === "/send") {
    const { to, subject, message } = (await req.json().catch(() => ({}))) ?? {};
    if (!to || !subject || !message) {
      return json({ error: "Missing required fields: to, subject, message" }, 400);
    }

    // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new one.
    const idempotencyKey = req.headers.get("idempotency-key") || crypto.randomUUID();

    try {
      const { data } = await emailsApi.emailsTransactionalPost({
        Recipients: { To: [to] },
        Content: {
          From: from,
          Subject: subject,
          Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
        },
      }, idempotencyKey);
      return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
    } catch (err) {
      const { status, message: error } = apiError(err);
      return json({ error }, status);
    }
  }

  // Elastic Email event notifications. A signed webhook created with DeliveryMethod PostJson
  // POSTs a flat JSON object; an unsigned one sends a GET with the same fields in the query string:
  // transaction, messageid, to, from, subject, date, status, category, channel, target (clicked URL),
  // ip, useragent, country, state, city. to/from/channel/subject/messageid may be null.
  if ((req.method === "GET" || req.method === "POST") && path === "/webhook") {
    // Signing secret (whsec_...) returned once when the webhook is created with EnableSigning.
    const signingSecret = Deno.env.get("ELASTICEMAIL_WEBHOOK_SECRET");
    let event: Record<string, unknown>;

    if (signingSecret) {
      // Verify the raw body and the raw path + query (new URL keeps the percent-encoding) before parsing.
      const raw = await req.text();
      const ok = await verifySignature(
        signingSecret,
        req.headers.get("x-elasticemail-timestamp"),
        req.headers.get("x-elasticemail-signature"),
        req.method,
        url.pathname + url.search,
        raw,
      );
      if (!ok) {
        // 401 makes Elastic Email retry. The test event sent when the webhook is created
        // arrives before you know the secret; Elastic Email accepts a 401 for that one.
        return json({ error: "Invalid signature" }, 401);
      }
      try {
        event = req.method === "POST" ? (JSON.parse(raw || "{}") ?? {}) : Object.fromEntries(url.searchParams);
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
    } else {
      // Unsigned webhook: the shared secret travels in the URL as ?token=
      if (!safeEqual(url.searchParams.get("token") ?? "", secret)) {
        return json({ error: "Invalid token" }, 401);
      }
      const body = req.method === "POST" ? await readBody(req) : {};
      event = { ...Object.fromEntries(url.searchParams), ...body };
    }

    const status = sanitize(event.status);

    if (!status) {
      return json({ ok: true });
    }

    console.log("Webhook event:", status, "to:", sanitize(event.to), "transaction:", sanitize(event.transaction));
    switch (status) {
      case "Sent":
        console.log("Email sent, message id:", sanitize(event.messageid));
        break;
      case "Opened":
        console.log("Email opened from", sanitize(event.country ?? event.Country), sanitize(event.city ?? event.City));
        break;
      case "Clicked":
        console.log("Link clicked:", sanitize(event.target));
        break;
      case "Error":
        console.log("Bounce/error, category:", sanitize(event.category));
        break;
      case "AbuseReport":
        console.log("Complaint received");
        break;
      case "Unsubscribed":
        console.log("Recipient unsubscribed");
        break;
    }

    return json({ received: true, status });
  }

  return json({ error: "Not found" }, 404);
});
