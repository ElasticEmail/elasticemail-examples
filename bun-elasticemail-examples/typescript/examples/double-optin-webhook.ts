import { createHmac, timingSafeEqual } from "node:crypto";
import { Configuration, ListsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.ts) pointing at /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const listsApi = new ListsApi(config);

const listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
const expectedToken = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
// Signing secret returned once when the webhook is created with EnableSigning
const webhookSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET;

const tokenOk = (token: unknown) => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(expectedToken);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Verify an Elastic Email webhook signature: lowercase hex HMAC-SHA256 (key = signing secret) of
 * "{timestamp}\n{METHOD}\n{path + query as received}\n{raw body}", sent as "v1=<hex>" entries
 * in X-ElasticEmail-Signature. Rejects timestamps more than 5 minutes off.
 */
const verifySignature = (
  signingSecret: string,
  method: string,
  target: string,
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean => {
  const ts = Number(timestamp);
  if (!timestamp || !Number.isInteger(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = Buffer.from(
    createHmac("sha256", signingSecret)
      .update(`${timestamp}\n${method}\n${target}\n${rawBody}`)
      .digest("hex"),
  );
  return String(signature ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .some((part) => {
      const given = Buffer.from(part.slice(3));
      return given.length === expected.length && timingSafeEqual(given, expected);
    });
};

const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  port,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname !== "/double-optin/webhook") {
      return json({ error: "Not found" }, 404);
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // Signed webhooks (EnableSigning + DeliveryMethod PostJson) arrive as POST with a JSON body;
    // unsigned ones as GET with the data in the query string and the shared ?token=.
    let event: Record<string, unknown>;
    if (webhookSecret) {
      // Raw body and request target exactly as received (new URL keeps the percent-encoding)
      const rawBody = req.method === "POST" ? await req.text() : "";
      const ok = verifySignature(
        webhookSecret,
        req.method,
        url.pathname + url.search,
        rawBody,
        req.headers.get("X-ElasticEmail-Timestamp") ?? undefined,
        req.headers.get("X-ElasticEmail-Signature") ?? undefined,
      );
      if (!ok) {
        return json({ error: "Invalid signature" }, 401);
      }
      event = req.method === "POST" ? (rawBody ? JSON.parse(rawBody) : {}) : Object.fromEntries(url.searchParams);
    } else {
      if (!tokenOk(url.searchParams.get("token"))) {
        return json({ error: "Invalid token" }, 401);
      }
      // Unsigned POSTs carry form-encoded fields
      const fields: Record<string, string> = Object.fromEntries(url.searchParams);
      if (req.method === "POST") {
        const form = await req.formData();
        form.forEach((v, k) => {
          if (typeof v === "string") fields[k] = v;
        });
      }
      event = fields;
    }

    const status = sanitize(event.status);
    const target = sanitize(event.target);
    const recipient = sanitize(event.to);

    // Elastic Email validates the URL with a test event when the webhook is saved.
    if (status !== "Clicked" || !target.includes("/double-optin/confirm")) {
      return json({ received: true, status, message: "Event ignored" });
    }

    try {
      await listsApi.listsByNameContactsPost(listName, { Emails: [recipient] });
      console.log("Subscription confirmed via click:", recipient);
      return json({ received: true, confirmed: true, email: recipient, list: listName });
    } catch (err: any) {
      console.error("Error adding contact to list:", err.response?.status, err.response?.data ?? err.message);
      return json({ error: err.response?.data?.Error ?? err.message }, 500);
    }
  },
});

console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
