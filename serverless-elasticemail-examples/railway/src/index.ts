import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { serve, type HttpBindings } from "@hono/node-server";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

if (!process.env.ELASTICEMAIL_API_KEY) {
  console.error("ELASTICEMAIL_API_KEY is not set. Run: railway variables set ELASTICEMAIL_API_KEY=...");
  process.exit(1);
}

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";

// HttpBindings exposes Node's IncomingMessage as c.env.incoming (used for the raw request target).
const app = new Hono<{ Bindings: HttpBindings }>();

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Verify an Elastic Email webhook signature:
 * X-ElasticEmail-Signature: v1=hex(HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${target}\n${rawBody}`)),
 * where target is the path + query exactly as requested (still URL-encoded).
 */
function verifySignature(
  key: string,
  timestamp: string | undefined,
  signatureHeader: string | undefined,
  method: string,
  target: string,
  body: Buffer | string,
): boolean {
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = Buffer.from(
    createHmac("sha256", key).update(`${timestamp}\n${method}\n${target}\n`).update(body).digest("hex"),
  );
  return (signatureHeader ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .some((part) => {
      const candidate = Buffer.from(part.slice(3));
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
}

const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

/** Elastic Email webhooks are form-encoded; JSON is accepted too. */
const readBody = async (c: any): Promise<Record<string, string>> => {
  const type = c.req.header("content-type") ?? "";
  if (type.includes("application/json")) return await c.req.json();
  if (type.includes("form")) {
    const body = await c.req.parseBody();
    return Object.fromEntries(
      Object.entries(body).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
  }
  return {};
};

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/send", async (c) => {
  const { to, subject, message } = (await c.req.json().catch(() => ({}))) ?? {};

  if (!to || !subject || !message) {
    return c.json({ error: "Missing required fields: to, subject, message" }, 400);
  }

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return c.json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return c.json({ error }, status);
  }
});

// Elastic Email event notifications. A signed webhook created with DeliveryMethod PostJson
// POSTs a flat JSON object; an unsigned one sends a GET with the same fields in the query string:
// transaction, messageid, to, from, subject, date, status, category, channel, target (clicked URL),
// ip, useragent, country, state, city. to/from/channel/subject/messageid may be null.
app.on(["GET", "POST"], "/webhook", async (c) => {
  // Signing secret (whsec_...) returned once when the webhook is created with EnableSigning.
  const signingSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET;
  let event: Record<string, unknown>;

  if (signingSecret) {
    // Verify the raw body and the request target exactly as received (IncomingMessage.url is the
    // undecoded path + query from the request line) before parsing anything.
    const raw = await c.req.text();
    const ok = verifySignature(
      signingSecret,
      c.req.header("x-elasticemail-timestamp"),
      c.req.header("x-elasticemail-signature"),
      c.req.method,
      c.env.incoming.url ?? "",
      raw,
    );
    if (!ok) {
      // 401 makes Elastic Email retry. The test event sent when the webhook is created
      // arrives before you know the secret; Elastic Email accepts a 401 for that one.
      return c.json({ error: "Invalid signature" }, 401);
    }
    try {
      event = c.req.method === "POST" ? (JSON.parse(raw || "{}") ?? {}) : c.req.query();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
  } else {
    // Unsigned webhook: the shared secret travels in the URL as ?token=
    if (!tokenOk(c.req.query("token"))) {
      return c.json({ error: "Invalid token" }, 401);
    }
    const body = c.req.method === "POST" ? await readBody(c) : {};
    event = { ...c.req.query(), ...body };
  }

  const status = sanitize(event.status);

  if (!status) {
    return c.json({ ok: true });
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

  return c.json({ received: true, status });
});

// Railway injects PORT; bind to 0.0.0.0 so the proxy can reach the container.
const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
