import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { api, APIError, type Header } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Secrets are set with `encore secret set --type dev,local,pr,prod ElasticEmailApiKey`
// and resolved lazily by calling the function.
const elasticEmailApiKey = secret("ElasticEmailApiKey");
const webhookToken = secret("ElasticEmailWebhookToken");
// Optional: the signing secret (whsec_...) returned once when the webhook is created with EnableSigning.
// When it is set, /webhook requires a valid signature; when it is not, the ?token= check is used.
const webhookSecret = secret("ElasticEmailWebhookSecret");

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";

let emailsApi: EmailsApi | undefined;
function getEmailsApi(): EmailsApi {
  const apiKey = elasticEmailApiKey();
  if (!apiKey) {
    throw APIError.internal("ElasticEmailApiKey secret is not set. Run: encore secret set ElasticEmailApiKey");
  }
  emailsApi ??= new EmailsApi(new Configuration({ apiKey }));
  return emailsApi;
}

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(webhookToken() || "change_me");
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

/** Encore throws when an unset secret is read; treat that as "not configured". */
const optionalSecret = (read: () => string): string => {
  try {
    return read();
  } catch {
    return "";
  }
};

interface SendRequest {
  to: string;
  subject: string;
  message: string;
  // Optional request header, forwarded to Elastic Email so a caller's retries can't send twice.
  idempotencyKey?: Header<"Idempotency-Key">;
}

interface SendResponse {
  success: boolean;
  transactionId?: string;
  messageId?: string;
}

export const health = api(
  { method: "GET", path: "/health", expose: true },
  async (): Promise<{ status: string }> => ({ status: "ok" }),
);

export const send = api(
  { method: "POST", path: "/send", expose: true },
  async ({ to, subject, message, idempotencyKey }: SendRequest): Promise<SendResponse> => {
    if (!to || !subject || !message) {
      throw APIError.invalidArgument("Missing required fields: to, subject, message");
    }

    try {
      const { data } = await getEmailsApi().emailsTransactionalPost({
        Recipients: { To: [to] },
        Content: {
          From: from,
          Subject: subject,
          Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
        },
      }, idempotencyKey || randomUUID());
      return { success: true, transactionId: data.TransactionID, messageId: data.MessageID };
    } catch (err: any) {
      const status: number = err.response?.status ?? 500;
      const detail: string = err.response?.data?.Error ?? err.message ?? "Unknown error";
      // Map the Elastic Email error onto Encore's error codes. The v4 API reports a bad key
      // ("APIKey Expired") and a missing access level ("Access Denied.") as 400, not 401/403.
      if (status === 400 && /APIKey Expired|Access Denied/i.test(detail)) throw APIError.permissionDenied(detail);
      if (status === 400 || status === 412 || status === 413) throw APIError.invalidArgument(detail);
      if (status === 404) throw APIError.notFound(detail);
      throw APIError.internal(detail);
    }
  },
);

// Elastic Email event notifications. A signed webhook created with DeliveryMethod PostJson
// POSTs a flat JSON object; an unsigned one sends a GET with the same fields in the query string:
// transaction, messageid, to, from, subject, date, status, category, channel, target (clicked URL),
// ip, useragent, country, state, city. to/from/channel/subject/messageid may be null.
// A raw endpoint is used because the signature covers the raw body and the raw request target.
export const webhook = api.raw(
  { method: ["GET", "POST"], path: "/webhook", expose: true },
  async (req, resp) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const reply = (status: number, body: unknown) => {
      resp.writeHead(status, { "Content-Type": "application/json" });
      resp.end(JSON.stringify(body));
    };

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks);
    const header = (name: string) => [req.headers[name]].flat()[0];

    const signingSecret = optionalSecret(webhookSecret);
    let event: Record<string, unknown>;

    if (signingSecret) {
      // req.url is the path + query exactly as it appeared on the request line (still URL-encoded).
      const ok = verifySignature(
        signingSecret,
        header("x-elasticemail-timestamp"),
        header("x-elasticemail-signature"),
        req.method ?? "",
        req.url ?? "",
        raw,
      );
      if (!ok) {
        // 401 makes Elastic Email retry. The test event sent when the webhook is created
        // arrives before you know the secret; Elastic Email accepts a 401 for that one.
        return reply(401, { error: "Invalid signature" });
      }
      try {
        event = req.method === "POST" ? (JSON.parse(raw.toString("utf8") || "{}") ?? {}) : Object.fromEntries(url.searchParams);
      } catch {
        return reply(400, { error: "Invalid JSON body" });
      }
    } else {
      // Unsigned webhook: the shared secret travels in the URL as ?token=
      if (!tokenOk(url.searchParams.get("token"))) {
        return reply(401, { error: "Invalid token" });
      }
      let body: Record<string, string> = {};
      if (req.method === "POST") {
        const text = raw.toString("utf8");
        const type = req.headers["content-type"] ?? "";
        try {
          if (type.includes("application/json") && text) body = JSON.parse(text);
          else if (type.includes("form")) body = Object.fromEntries(new URLSearchParams(text));
        } catch {
          return reply(400, { error: "Invalid JSON body" });
        }
      }
      event = { ...Object.fromEntries(url.searchParams), ...body };
    }

    const status = sanitize(event.status);

    if (!status) {
      return reply(200, { ok: true });
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

    reply(200, { received: true, status });
  },
);
