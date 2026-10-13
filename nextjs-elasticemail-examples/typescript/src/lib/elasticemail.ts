import { createHmac, timingSafeEqual } from "node:crypto";
import {
  Configuration,
  ContactsApi,
  DomainsApi,
  EmailsApi,
  ListsApi,
  StatisticsApi,
  TemplatesApi,
} from "@elasticemail/elasticemail-client-ts-axios";

export const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
export const contactEmail = process.env.CONTACT_EMAIL || from;
export const listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
export const templateName = process.env.ELASTICEMAIL_TEMPLATE_NAME || "welcome-example";
export const sendingDomain = process.env.SENDING_DOMAIN || "yourdomain.com";
export const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
export const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
// Signing secret returned once when the webhook is created with EnableSigning (whsec_...)
export const webhookSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET || "";

let config: Configuration | undefined;

function getConfig(): Configuration {
  if (!config) {
    const apiKey = process.env.ELASTICEMAIL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing ELASTICEMAIL_API_KEY environment variable. " +
          "Get your API key from https://app.elasticemail.com/marketing/settings/new/manage-api",
      );
    }
    config = new Configuration({ apiKey });
  }
  return config;
}

// API classes are created on first use so importing this module never throws
// (for example during `next build` when no .env is present).
function lazy<T extends object>(create: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_target, prop) {
      instance ??= create();
      const value = Reflect.get(instance, prop);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

export const emailsApi = lazy(() => new EmailsApi(getConfig()));
export const contactsApi = lazy(() => new ContactsApi(getConfig()));
export const listsApi = lazy(() => new ListsApi(getConfig()));
export const domainsApi = lazy(() => new DomainsApi(getConfig()));
export const templatesApi = lazy(() => new TemplatesApi(getConfig()));
export const statisticsApi = lazy(() => new StatisticsApi(getConfig()));

/** Normalize an axios error from the SDK into { status, message } */
export function apiError(err: unknown): { status: number; message: string } {
  const e = err as { response?: { status?: number; data?: { Error?: string } }; message?: string };
  return {
    status: e.response?.status ?? 500,
    message: e.response?.data?.Error ?? e.message ?? "Unknown error",
  };
}

/** Constant-time comparison of the shared secret carried in ?token= */
export function tokenOk(token: unknown): boolean {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hmac(value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Strip newlines from user-controlled values before logging */
export function sanitize(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]/g, "");
}

/** Merge query string params with form fields (Elastic Email posts webhooks form-encoded) */
export async function readEvent(request: Request): Promise<Record<string, string>> {
  const event: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) event[key] = value;
  if (request.method === "POST") {
    const form = await request.formData();
    for (const [key, value] of form) event[key] = String(value);
  }
  return event;
}

/**
 * Verify an Elastic Email webhook signature (webhooks created with EnableSigning: true).
 * X-ElasticEmail-Signature carries one or more comma-separated "v1=<hex>" entries, each
 * hex(HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${target}\n${rawBody}`)), where target is
 * the path + query exactly as requested (still URL-encoded) and rawBody is "" for GET.
 * Requests older or newer than 5 minutes are rejected to limit replays.
 */
export function verifySignature(
  secret: string,
  timestamp: string | null | undefined,
  signature: string | null | undefined,
  method: string,
  target: string,
  rawBody: string | Uint8Array,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}\n${method.toUpperCase()}\n${target}\n`)
    .update(rawBody)
    .digest();
  return signature.split(",").some((entry) => {
    const match = /^v1=([0-9a-f]{64})$/i.exec(entry.trim());
    return match !== null && timingSafeEqual(Buffer.from(match[1], "hex"), expected);
  });
}

/** Lowercase the keys and stringify the values (PostJson sends null for missing to/from/subject/...) */
function normalizeEvent(fields: Record<string, unknown>): Record<string, string> {
  const event: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) event[key.toLowerCase()] = value == null ? "" : String(value);
  return event;
}

/** Parse the JSON object sent by PostJson webhooks, returning {} when it is missing or malformed */
function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Authenticate an Elastic Email webhook request and return its event fields (keys lowercased),
 * or null when the request must be rejected with 401 (Elastic Email then retries).
 * - ELASTICEMAIL_WEBHOOK_SECRET set: a valid X-ElasticEmail-Signature is required. The event is
 *   the JSON body (POST, DeliveryMethod PostJson) or the query string (GET).
 * - Not set: unsigned webhooks fall back to the shared ?token= (ELASTICEMAIL_WEBHOOK_TOKEN).
 */
export async function readWebhook(request: Request): Promise<Record<string, string> | null> {
  const url = new URL(request.url);
  if (!webhookSecret) {
    return tokenOk(url.searchParams.get("token")) ? normalizeEvent(await readEvent(request)) : null;
  }
  // Read the raw body before parsing: the signature covers the exact bytes received.
  const rawBody = request.method === "POST" ? await request.text() : "";
  const valid = verifySignature(
    webhookSecret,
    request.headers.get("x-elasticemail-timestamp"),
    request.headers.get("x-elasticemail-signature"),
    request.method,
    url.pathname + url.search, // keeps the URL encoding of the request line
    rawBody,
  );
  if (!valid) return null;
  return normalizeEvent(request.method === "POST" ? parseJsonObject(rawBody) : Object.fromEntries(url.searchParams));
}
