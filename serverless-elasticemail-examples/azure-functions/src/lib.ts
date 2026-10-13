import { createHmac, timingSafeEqual } from "node:crypto";
import type { HttpRequest } from "@azure/functions";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

let emailsApi: EmailsApi | undefined;
export function getEmailsApi(): EmailsApi {
  if (!process.env.ELASTICEMAIL_API_KEY) {
    throw new Error("ELASTICEMAIL_API_KEY is not set. Add it to local.settings.json or the Function App's app settings");
  }
  // Reused across invocations on a warm instance
  emailsApi ??= new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));
  return emailsApi;
}

/** Strip newlines from user-controlled values before logging */
export const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
export const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me");
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Verify an Elastic Email webhook signature:
 * X-ElasticEmail-Signature: v1=hex(HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${target}\n${rawBody}`)),
 * where target is the path + query exactly as requested (still URL-encoded).
 */
export function verifySignature(
  key: string,
  timestamp: string | null,
  signatureHeader: string | null,
  method: string,
  target: string,
  body: string,
): boolean {
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = Buffer.from(
    createHmac("sha256", key).update(`${timestamp}\n${method}\n${target}\n${body}`).digest("hex"),
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

export const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

/** Elastic Email webhooks are form-encoded; JSON is accepted too. */
export async function readBody(req: HttpRequest): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return (await req.json()) as Record<string, string>;
  if (type.includes("form")) {
    const out: Record<string, string> = {};
    (await req.formData()).forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  }
  return {};
}
