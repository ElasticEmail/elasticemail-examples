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
export const publicUrl = process.env.PUBLIC_URL || "http://localhost:8910";
export const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
// Signing secret returned once when the webhook is created with EnableSigning (whsec_...)
export const webhookSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET || "";

let config;

function getConfig() {
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
// (for example during `rw build` when no .env is present).
function lazy(create) {
  let instance;
  return new Proxy(
    {},
    {
      get(_target, prop) {
        instance ??= create();
        const value = Reflect.get(instance, prop);
        return typeof value === "function" ? value.bind(instance) : value;
      },
    },
  );
}

export const emailsApi = lazy(() => new EmailsApi(getConfig()));
export const contactsApi = lazy(() => new ContactsApi(getConfig()));
export const listsApi = lazy(() => new ListsApi(getConfig()));
export const domainsApi = lazy(() => new DomainsApi(getConfig()));
export const templatesApi = lazy(() => new TemplatesApi(getConfig()));
export const statisticsApi = lazy(() => new StatisticsApi(getConfig()));

/** Normalize an axios error from the SDK into { status, message } */
export function apiError(err) {
  const e = err;
  return {
    status: e.response?.status ?? 500,
    message: e.response?.data?.Error ?? e.message ?? "Unknown error",
  };
}

/** Constant-time comparison of the shared secret carried in ?token= */
export function tokenOk(token) {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hmac(value) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Strip newlines from user-controlled values before logging */
export function sanitize(value) {
  return String(value ?? "").replace(/[\r\n]/g, "");
}

/** JSON response with the given status */
export function json(data, status = 200) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: "" };
}

export function query(event) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(event.queryStringParameters ?? {})) {
    if (value !== undefined) params.set(key, value);
  }
  return params;
}

/** Raw request body as text. Redwood flags binary bodies with isBase64Encoded. */
function rawBodyBytes(event) {
  if (!event.body) return Buffer.alloc(0);
  return Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");
}

function rawBody(event) {
  return rawBodyBytes(event).toString("utf8");
}

/** Merge query string params with form fields (Elastic Email posts webhooks form-encoded) */
export async function readEvent(event) {
  const merged = {};
  for (const [key, value] of query(event)) merged[key] = value;
  if (event.httpMethod === "POST") {
    for (const [key, value] of new URLSearchParams(rawBody(event))) merged[key] = value;
  }
  return merged;
}

/** Parse a JSON request body, returning {} when it is missing or malformed */
export async function readJson(event) {
  try {
    return JSON.parse(rawBody(event) || "{}");
  } catch {
    return {};
  }
}

/**
 * Verify an Elastic Email webhook signature (webhooks created with EnableSigning: true).
 * X-ElasticEmail-Signature carries one or more comma-separated "v1=<hex>" entries, each
 * hex(HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${target}\n${rawBody}`)), where target is
 * the path + query exactly as requested (still URL-encoded) and rawBody is "" for GET.
 * Requests older or newer than 5 minutes are rejected to limit replays.
 */
export function verifySignature(secret, timestamp, signature, method, target, rawBody, now = Math.floor(Date.now() / 1000)) {
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
function normalizeEvent(fields) {
  const event = {};
  for (const [key, value] of Object.entries(fields)) event[key.toLowerCase()] = value == null ? "" : String(value);
  return event;
}

/** Parse the JSON object sent by PostJson webhooks, returning {} when it is missing or malformed */
function parseJsonObject(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}


/** Prefix the web side proxies to the API server (apiUrl in redwood.toml) */
const apiUrl = "/.redwood/functions";

/** Case-insensitive header lookup (API Gateway style events keep the original header case) */
function header(event, name) {
  const key = Object.keys(event.headers ?? {}).find((k) => k.toLowerCase() === name);
  return key ? event.headers[key] : undefined;
}

/**
 * Request target that Elastic Email signed: the public path (the proxy strips apiUrl before the
 * function sees it) plus the query string. API Gateway style events only carry decoded query
 * parameters, so the query is re-encoded; webhooks created without a query string (recommended
 * for signed webhooks) are not affected.
 */
function requestTarget(event) {
  const path = event.path.startsWith(apiUrl) ? event.path : apiUrl + event.path;
  const pairs = Object.entries(event.queryStringParameters ?? {}).filter(([, v]) => v !== undefined);
  const search = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return search ? `${path}?${search}` : path;
}

/**
 * Authenticate an Elastic Email webhook request and return its event fields (keys lowercased),
 * or null when the request must be rejected with 401 (Elastic Email then retries).
 * - ELASTICEMAIL_WEBHOOK_SECRET set: a valid X-ElasticEmail-Signature is required. The event is
 *   the JSON body (POST, DeliveryMethod PostJson) or the query string (GET).
 * - Not set: unsigned webhooks fall back to the shared ?token= (ELASTICEMAIL_WEBHOOK_TOKEN).
 */
export async function readWebhook(event) {
  if (!webhookSecret) {
    return tokenOk(query(event).get("token")) ? normalizeEvent(await readEvent(event)) : null;
  }
  // Read the raw body before parsing: the signature covers the exact bytes received.
  const body = event.httpMethod === "POST" ? rawBodyBytes(event) : Buffer.alloc(0);
  const valid = verifySignature(
    webhookSecret,
    header(event, "x-elasticemail-timestamp"),
    header(event, "x-elasticemail-signature"),
    event.httpMethod,
    requestTarget(event),
    body,
  );
  if (!valid) return null;
  return normalizeEvent(event.httpMethod === "POST" ? parseJsonObject(body.toString("utf8")) : Object.fromEntries(query(event)));
}
