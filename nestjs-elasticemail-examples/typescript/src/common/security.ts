import { createHmac, timingSafeEqual } from "node:crypto";

/** Shared secret carried in ?token= on webhook and inbound URLs, also the HMAC key for confirm links */
export const webhookSecret = (): string => process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";

/** Constant-time string comparison */
export const safeEqual = (given: unknown, expected: string): boolean => {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const hmac = (value: string): string =>
  createHmac("sha256", webhookSecret()).update(value).digest("hex");

/** Signing secret (whsec_...) returned once when the webhook is created with EnableSigning */
export const signingSecret = (): string => process.env.ELASTICEMAIL_WEBHOOK_SECRET || "";

/**
 * Verify an Elastic Email webhook signature.
 * signature = hex(HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${target}\n${rawBody}`)), where target is
 * the path + query exactly as received (still URL-encoded) and rawBody the body bytes as received
 * ("" for GET). X-ElasticEmail-Signature is a comma-separated list of v1=<hex>; any match is accepted.
 */
export const verifySignature = (
  secret: string,
  method: string,
  target: string,
  rawBody: Buffer | string,
  timestamp: unknown,
  signatureHeader: unknown,
): boolean => {
  const ts = String(timestamp ?? "");
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${ts}\n${method.toUpperCase()}\n${target}\n`)
    .update(rawBody)
    .digest("hex");
  return String(signatureHeader ?? "")
    .split(",")
    .map((part) => part.trim())
    .some((part) => part.startsWith("v1=") && safeEqual(part.slice(3), expected));
};

type Fields = Record<string, unknown>;

/**
 * Event fields of a webhook request, keys lowercased. Signed POST webhooks carry the event as a
 * JSON body only; unsigned ones may mix query string and form fields.
 */
export const webhookEvent = (query: Fields, body?: Fields | null): Record<string, string> => {
  const sources = body && signingSecret() ? [body] : [query, body ?? {}];
  const event: Record<string, string> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value !== null && value !== undefined) event[key.toLowerCase()] = String(value);
    }
  }
  return event;
};

/** Strip newlines from user-controlled values before logging */
export const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");
