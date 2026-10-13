import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  Configuration,
  ContactsApi,
  EmailsApi,
  ListsApi,
} from "@elasticemail/elasticemail-client-ts-axios";

// Bun loads .env automatically, so no dotenv import is needed.
const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);
const contactsApi = new ContactsApi(config);
const listsApi = new ListsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const contactEmail = process.env.CONTACT_EMAIL || from;
const listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
// Signing secret returned once when the webhook is created with EnableSigning
const webhookSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET;
const confirmRedirectUrl = process.env.CONFIRM_REDIRECT_URL;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(secret);
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

const hmac = (value: string) => createHmac("sha256", secret).update(value).digest("hex");

const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

/** Elastic Email webhooks and inbound notifications are form-encoded; JSON is accepted too. */
async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return await req.json();
  if (type.includes("form")) {
    const form = await req.formData();
    const out: Record<string, string> = {};
    form.forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  }
  return {};
}

const queryToObject = (url: URL): Record<string, string> => Object.fromEntries(url.searchParams);

/**
 * Authenticate an Elastic Email webhook request and return its event fields (keys lowercased),
 * or null. With ELASTICEMAIL_WEBHOOK_SECRET set, the signature is required and the event is the
 * JSON body (POST) or the query string (GET); otherwise the ?token= shared secret is checked.
 */
async function webhookEvent(req: Request, url: URL): Promise<Record<string, unknown> | null> {
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
    if (!ok) return null;
    event = req.method === "POST" ? (rawBody ? JSON.parse(rawBody) : {}) : queryToObject(url);
  } else {
    if (!tokenOk(url.searchParams.get("token"))) return null;
    const body = req.method === "POST" ? await readBody(req) : {};
    event = { ...queryToObject(url), ...body };
  }
  return Object.fromEntries(Object.entries(event).map(([k, v]) => [k.toLowerCase(), v]));
}

const unauthorized = { error: webhookSecret ? "Invalid signature" : "Invalid token" };

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // GET /health
    if (req.method === "GET" && path === "/health") {
      return json({ status: "ok" });
    }

    // POST /send
    if (req.method === "POST" && path === "/send") {
      const { to, subject, message } = (await req.json()) ?? {};

      if (!to || !subject || !message) {
        return json({ error: "Missing required fields: to, subject, message" }, 400);
      }

      // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new key.
      const idempotencyKey = req.headers.get("Idempotency-Key") || randomUUID();

      try {
        const { data } = await emailsApi.emailsTransactionalPost({
          Recipients: { To: [to] },
          Content: {
            From: from,
            Subject: subject,
            Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
          },
        }, idempotencyKey);
        return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
      } catch (err) {
        const { status, message: error } = apiError(err);
        return json({ error }, status);
      }
    }

    // GET|POST /webhook
    // Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
    // category, channel, target (clicked URL), ip, useragent, country, city.
    // Signed webhooks (EnableSigning + DeliveryMethod PostJson) arrive as POST with a JSON body and
    // X-ElasticEmail-* signature headers; unsigned ones as GET with the fields in the query string.
    // Elastic Email sends a test event when the webhook is saved.
    if ((req.method === "GET" || req.method === "POST") && path === "/webhook") {
      const event = await webhookEvent(req, url);
      if (!event) {
        return json(unauthorized, 401);
      }

      const status = sanitize(event.status);

      if (!status) {
        // Validation ping or empty request
        return json({ ok: true });
      }

      console.log("Webhook event:", status, "to:", sanitize(event.to), "transaction:", sanitize(event.transaction));

      switch (status) {
        case "Sent":
          console.log("Email sent, message id:", sanitize(event.messageid));
          break;
        case "Opened":
          console.log("Email opened from", sanitize(event.country), sanitize(event.city));
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

      return json({ received: true, status });
    }

    // POST /inbound
    // Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
    // Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
    // subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
    if (req.method === "POST" && path === "/inbound") {
      if (!tokenOk(url.searchParams.get("token"))) {
        return json({ error: "Invalid token" }, 401);
      }

      const mail = await readBody(req);
      const attachments = Object.keys(mail)
        .filter((k) => /^att\d+_name$/.test(k))
        .map((k) => ({ name: mail[k], content: mail[k.replace("_name", "_content")] }));

      console.log("Inbound email from:", sanitize(mail.from_email), "subject:", sanitize(mail.subject));
      console.log("Attachments:", attachments.map((a) => a.name).join(", ") || "none");

      // Forward a copy to the team inbox
      try {
        const { data } = await emailsApi.emailsTransactionalPost({
          Recipients: { To: [contactEmail] },
          Content: {
            From: from,
            ReplyTo: mail.from_email,
            Subject: `Fwd: ${mail.subject ?? "(no subject)"}`,
            Body: [
              {
                ContentType: "HTML",
                Content:
                  mail.body_html ||
                  `<pre>${(mail.body_text ?? "").replace(/</g, "&lt;")}</pre>`,
              },
            ],
            Attachments: attachments
              .filter((a) => a.content)
              .map((a) => ({ Name: a.name, BinaryContent: a.content })),
          },
        });
        return json({ received: true, forwardedMessageId: data.MessageID });
      } catch (err) {
        const { status, message } = apiError(err);
        return json({ error: message }, status);
      }
    }

    // POST /double-optin/subscribe
    if (req.method === "POST" && path === "/double-optin/subscribe") {
      const { email, name = "" } = (await req.json()) ?? {};

      if (!email) {
        return json({ error: "Missing required field: email" }, 400);
      }

      const confirmUrl = `${publicUrl}/double-optin/confirm?email=${encodeURIComponent(email)}&token=${hmac(email)}`;
      const greeting = name ? `Welcome, ${name}!` : "Welcome!";

      try {
        // Stored as Transactional so it receives the confirmation but no campaigns yet
        await contactsApi.contactsPost([
          { Email: email, FirstName: name.split(" ")[0] || "", Status: "Transactional" },
        ]);

        const { data } = await emailsApi.emailsTransactionalPost({
          Recipients: { To: [email] },
          Content: {
            From: from,
            Subject: "Confirm your subscription",
            Body: [
              {
                ContentType: "HTML",
                Content: `<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>${greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="${confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>`,
              },
            ],
          },
        });

        return json({ success: true, message: "Confirmation email sent", messageId: data.MessageID });
      } catch (err) {
        const { status, message } = apiError(err);
        return json({ error: message }, status);
      }
    }

    // GET /double-optin/confirm
    if (req.method === "GET" && path === "/double-optin/confirm") {
      const email = url.searchParams.get("email") ?? "";
      const token = url.searchParams.get("token") ?? "";

      const expected = Buffer.from(hmac(email));
      const given = Buffer.from(token);
      if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
        return json({ error: "Invalid confirmation link" }, 400);
      }

      try {
        await listsApi.listsByNameContactsPost(listName, { Emails: [email] });
        if (confirmRedirectUrl) {
          return Response.redirect(confirmRedirectUrl, 302);
        }
        return json({ confirmed: true, email, list: listName });
      } catch (err) {
        const { status, message } = apiError(err);
        return json({ error: message }, status);
      }
    }

    // GET|POST /double-optin/webhook
    // Click-tracking based confirmation: create a webhook for Clicked events pointing here.
    if ((req.method === "GET" || req.method === "POST") && path === "/double-optin/webhook") {
      const event = await webhookEvent(req, url);
      if (!event) {
        return json(unauthorized, 401);
      }

      if (event.status !== "Clicked" || !String(event.target ?? "").includes("/double-optin/confirm")) {
        return json({ received: true, status: sanitize(event.status), message: "Event ignored" });
      }

      try {
        await listsApi.listsByNameContactsPost(listName, { Emails: [String(event.to)] });
        return json({ received: true, confirmed: true, email: sanitize(event.to) });
      } catch (err) {
        const { status, message } = apiError(err);
        return json({ error: message }, status);
      }
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Bun server running on http://localhost:${process.env.PORT || 3000}`);
