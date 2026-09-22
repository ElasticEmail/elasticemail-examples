import { createHmac, timingSafeEqual } from "node:crypto";
import { getQuery, readBody, setResponseStatus } from "h3";
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
// (for example during `nuxt build` when no .env is present).
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

/**
 * Merge query string params with form fields (Elastic Email posts webhooks form-encoded).
 * h3 parses application/x-www-form-urlencoded bodies into an object in readBody.
 */
export async function readEvent(event) {
  const merged = {};
  for (const [key, value] of Object.entries(getQuery(event))) merged[key] = String(value ?? "");
  if (event.method === "POST") {
    const body = await readBody(event).catch(() => ({}));
    if (body && typeof body === "object") {
      for (const [key, value] of Object.entries(body)) merged[key] = String(value ?? "");
    }
  }
  return merged;
}

/** Parse a JSON request body, returning {} when it is missing or malformed */
export async function readJson(event) {
  const body = await readBody(event).catch(() => ({}));
  return body && typeof body === "object" ? body : {};
}

/** Set the HTTP status and return the { error } body used by every route */
export function fail(event, status, error) {
  setResponseStatus(event, status);
  return { error };
}
