// HTTP actions run in Convex's default JavaScript runtime (no node:http, no node:crypto; WebCrypto is there), so the
// Elastic Email SDK call lives in the Node action in email.ts and is invoked with ctx.runAction.
// Routes are served from https://<deployment>.convex.site
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time string compare (no node:crypto in this runtime) */
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

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => json({ status: "ok" })),
});

http.route({
  path: "/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { to, subject, message } = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    if (typeof to !== "string" || typeof subject !== "string" || typeof message !== "string" || !to || !subject || !message) {
      return json({ error: "Missing required fields: to, subject, message" }, 400);
    }

    const result = await ctx.runAction(internal.email.send, { to, subject, message });
    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }
    return json({ success: true, transactionId: result.transactionId, messageId: result.messageId });
  }),
});

// Elastic Email event notifications. A signed webhook created with DeliveryMethod PostJson
// POSTs a flat JSON object; an unsigned one sends a GET with the same fields in the query string:
// transaction, messageid, to, from, subject, date, status, category, channel, target (clicked URL),
// ip, useragent, country, state, city. to/from/channel/subject/messageid may be null.
const webhook = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  // Signing secret (whsec_...) returned once when the webhook is created with EnableSigning.
  const signingSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET;
  let event: Record<string, unknown>;

  if (signingSecret) {
    // Verify the raw body and the raw path + query (new URL keeps the percent-encoding) before parsing.
    const raw = await request.text();
    const ok = await verifySignature(
      signingSecret,
      request.headers.get("x-elasticemail-timestamp"),
      request.headers.get("x-elasticemail-signature"),
      request.method,
      url.pathname + url.search,
      raw,
    );
    if (!ok) {
      // 401 makes Elastic Email retry. The test event sent when the webhook is created
      // arrives before you know the secret; Elastic Email accepts a 401 for that one.
      return json({ error: "Invalid signature" }, 401);
    }
    try {
      event = request.method === "POST" ? (JSON.parse(raw || "{}") ?? {}) : Object.fromEntries(url.searchParams);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
  } else {
    // Unsigned webhook: the shared secret travels in the URL as ?token=
    if (!safeEqual(url.searchParams.get("token") ?? "", process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me")) {
      return json({ error: "Invalid token" }, 401);
    }
    const body = request.method === "POST" ? await readBody(request) : {};
    event = { ...Object.fromEntries(url.searchParams), ...body };
  }

  const status = sanitize(event.status);

  if (!status) {
    return json({ ok: true });
  }

  // To store events, call a mutation here: await ctx.runMutation(internal.events.record, { ... })
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
});

http.route({ path: "/webhook", method: "GET", handler: webhook });
http.route({ path: "/webhook", method: "POST", handler: webhook });

export default http;
