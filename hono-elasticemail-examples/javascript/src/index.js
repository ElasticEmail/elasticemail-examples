import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  Configuration,
  ContactsApi,
  EmailsApi,
  ListsApi,
} from "@elasticemail/elasticemail-client-ts-axios";

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

const app = new Hono();

/** Strip newlines from user-controlled values before logging */
const sanitize = (value) => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
const tokenOk = (token) => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Verify an Elastic Email webhook signature: lowercase hex HMAC-SHA256 (key = signing secret) of
 * "{timestamp}\n{METHOD}\n{path + query as received}\n{raw body}", sent as "v1=<hex>" entries
 * in X-ElasticEmail-Signature. Rejects timestamps more than 5 minutes off.
 */
const verifySignature = (signingSecret, method, target, rawBody, timestamp, signature) => {
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

const hmac = (value) => createHmac("sha256", secret).update(value).digest("hex");

const apiError = (err) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

/** Elastic Email webhooks and inbound notifications are form-encoded; JSON is accepted too. */
const readBody = async (c) => {
  const type = c.req.header("content-type") ?? "";
  if (type.includes("application/json")) return await c.req.json();
  if (type.includes("form")) {
    const body = await c.req.parseBody();
    return Object.fromEntries(
      Object.entries(body).filter(([, v]) => typeof v === "string"),
    );
  }
  return {};
};

/**
 * Authenticate an Elastic Email webhook request and return its event fields (keys lowercased),
 * or null. With ELASTICEMAIL_WEBHOOK_SECRET set, the signature is required and the event is the
 * JSON body (POST) or the query string (GET); otherwise the ?token= shared secret is checked.
 */
const webhookEvent = async (c) => {
  let event;
  if (webhookSecret) {
    // Raw body and request target exactly as received (new URL keeps the percent-encoding)
    const rawBody = c.req.method === "POST" ? await c.req.text() : "";
    const url = new URL(c.req.url);
    const ok = verifySignature(
      webhookSecret,
      c.req.method,
      url.pathname + url.search,
      rawBody,
      c.req.header("X-ElasticEmail-Timestamp"),
      c.req.header("X-ElasticEmail-Signature"),
    );
    if (!ok) return null;
    event = c.req.method === "POST" ? (rawBody ? JSON.parse(rawBody) : {}) : c.req.query();
  } else {
    if (!tokenOk(c.req.query("token"))) return null;
    const body = c.req.method === "POST" ? await readBody(c) : {};
    event = { ...c.req.query(), ...body };
  }
  return Object.fromEntries(Object.entries(event).map(([k, v]) => [k.toLowerCase(), v]));
};

const unauthorized = { error: webhookSecret ? "Invalid signature" : "Invalid token" };

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/send", async (c) => {
  const { to, subject, message } = (await c.req.json()) ?? {};

  if (!to || !subject || !message) {
    return c.json({ error: "Missing required fields: to, subject, message" }, 400);
  }

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return c.json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return c.json({ error }, status);
  }
});

// Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
// category, channel, target (clicked URL), ip, useragent, country, city.
// Signed webhooks (EnableSigning + DeliveryMethod PostJson) arrive as POST with a JSON body and
// X-ElasticEmail-* signature headers; unsigned ones as GET with the fields in the query string.
// Elastic Email sends a test event when the webhook is saved.
app.on(["GET", "POST"], "/webhook", async (c) => {
  const event = await webhookEvent(c);
  if (!event) {
    return c.json(unauthorized, 401);
  }

  const status = sanitize(event.status);

  if (!status) {
    // Validation ping or empty request
    return c.json({ ok: true });
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

  return c.json({ received: true, status });
});

// Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
app.post("/inbound", async (c) => {
  if (!tokenOk(c.req.query("token"))) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const mail = await readBody(c);
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
    return c.json({ received: true, forwardedMessageId: data.MessageID });
  } catch (err) {
    const { status, message } = apiError(err);
    return c.json({ error: message }, status);
  }
});

app.post("/double-optin/subscribe", async (c) => {
  const { email, name = "" } = (await c.req.json()) ?? {};

  if (!email) {
    return c.json({ error: "Missing required field: email" }, 400);
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

    return c.json({ success: true, message: "Confirmation email sent", messageId: data.MessageID });
  } catch (err) {
    const { status, message } = apiError(err);
    return c.json({ error: message }, status);
  }
});

app.get("/double-optin/confirm", async (c) => {
  const email = c.req.query("email") ?? "";
  const token = c.req.query("token") ?? "";

  const expected = Buffer.from(hmac(email));
  const given = Buffer.from(token);
  if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return c.json({ error: "Invalid confirmation link" }, 400);
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [email] });
    if (confirmRedirectUrl) {
      return c.redirect(confirmRedirectUrl);
    }
    return c.json({ confirmed: true, email, list: listName });
  } catch (err) {
    const { status, message } = apiError(err);
    return c.json({ error: message }, status);
  }
});

// Click-tracking based confirmation: create a webhook for Clicked events pointing here.
app.on(["GET", "POST"], "/double-optin/webhook", async (c) => {
  const event = await webhookEvent(c);
  if (!event) {
    return c.json(unauthorized, 401);
  }

  if (event.status !== "Clicked" || !String(event.target ?? "").includes("/double-optin/confirm")) {
    return c.json({ received: true, status: sanitize(event.status), message: "Event ignored" });
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [event.to] });
    return c.json({ received: true, confirmed: true, email: sanitize(event.to) });
  } catch (err) {
    const { status, message } = apiError(err);
    return c.json({ error: message }, status);
  }
});

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, () => {
  console.log(`Hono server running on http://localhost:${port}`);
});
