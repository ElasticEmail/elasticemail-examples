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

/** Strip newlines from user-controlled values before logging */
export const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");
