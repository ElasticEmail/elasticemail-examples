import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
// Signing secret (whsec_...) returned once when the webhook is created with EnableSigning.
// When set, /webhook requires a valid signature; when empty, it falls back to the ?token= check.
const signingSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET || "";

let emailsApi: EmailsApi | undefined;
function getEmailsApi(): EmailsApi {
  if (!process.env.ELASTICEMAIL_API_KEY) {
    throw new Error("ELASTICEMAIL_API_KEY is not set. Pass ElasticEmailApiKey to `sam deploy`");
  }
  // Reused across warm invocations
  emailsApi ??= new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));
  return emailsApi;
}

type Result = Exclude<APIGatewayProxyResultV2, string>;

const json = (data: unknown, statusCode = 200): Result => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

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

/** API Gateway base64-encodes binary-looking bodies; form posts often arrive that way. */
const rawBytes = (event: APIGatewayProxyEventV2): Buffer =>
  event.body ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8") : Buffer.alloc(0);
const rawBody = (event: APIGatewayProxyEventV2): string => rawBytes(event).toString("utf8");

/** Elastic Email webhooks are form-encoded; JSON is accepted too. */
function readBody(event: APIGatewayProxyEventV2): Record<string, string> {
  const type = event.headers["content-type"] ?? event.headers["Content-Type"] ?? "";
  const body = rawBody(event);
  if (!body) return {};
  if (type.includes("application/json")) return JSON.parse(body);
  if (type.includes("form")) return Object.fromEntries(new URLSearchParams(body));
  return {};
}

export async function handler(event: APIGatewayProxyEventV2): Promise<Result> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const query = event.queryStringParameters ?? {};

  if (method === "GET" && path === "/health") {
    return json({ status: "ok" });
  }

  if (method === "POST" && path === "/send") {
    let payload: Record<string, string> = {};
    try {
      payload = JSON.parse(rawBody(event) || "{}");
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { to, subject, message } = payload;
    if (!to || !subject || !message) {
      return json({ error: "Missing required fields: to, subject, message" }, 400);
    }

    try {
      const { data } = await getEmailsApi().emailsTransactionalPost({
        Recipients: { To: [to] },
        Content: {
          From: from,
          Subject: subject,
          Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
        },
      });
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
  if ((method === "GET" || method === "POST") && path === "/webhook") {
    let evt: Record<string, unknown>;
    if (signingSecret) {
      // Verify against the raw bytes and the raw path + query, before any parsing.
      const body = rawBytes(event);
      const target = event.rawPath + (event.rawQueryString ? `?${event.rawQueryString}` : "");
      const ok = verifySignature(
        signingSecret,
        event.headers["x-elasticemail-timestamp"],
        event.headers["x-elasticemail-signature"],
        method,
        target,
        body,
      );
      if (!ok) {
        // 401 makes Elastic Email retry. The test event sent when the webhook is created
        // arrives before you know the secret; Elastic Email accepts a 401 for that one.
        return json({ error: "Invalid signature" }, 401);
      }
      try {
        evt = method === "POST" ? (JSON.parse(body.toString("utf8") || "{}") ?? {}) : query;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
    } else {
      // Unsigned webhook: the shared secret travels in the URL as ?token=
      if (!tokenOk(query.token)) {
        return json({ error: "Invalid token" }, 401);
      }
      const body = method === "POST" ? readBody(event) : {};
      evt = { ...query, ...body };
    }

    const status = sanitize(evt.status);

    if (!status) {
      return json({ ok: true });
    }

    console.log("Webhook event:", status, "to:", sanitize(evt.to), "transaction:", sanitize(evt.transaction));
    switch (status) {
      case "Sent":
        console.log("Email sent, message id:", sanitize(evt.messageid));
        break;
      case "Opened":
        console.log("Email opened from", sanitize(evt.country ?? evt.Country), sanitize(evt.city ?? evt.City));
        break;
      case "Clicked":
        console.log("Link clicked:", sanitize(evt.target));
        break;
      case "Error":
        console.log("Bounce/error, category:", sanitize(evt.category));
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
}
