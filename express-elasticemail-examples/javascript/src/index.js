import "dotenv/config";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
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

const app = express();
// Keep the raw bytes: webhook signatures are computed over the body exactly as sent
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
// Elastic Email webhooks and inbound notifications are form-encoded
app.use(express.urlencoded({ extended: false, limit: "25mb" }));

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
      .update(`${timestamp}\n${method}\n${target}\n`)
      .update(rawBody)
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

/**
 * Authenticate an Elastic Email webhook request and return its event fields (keys lowercased),
 * or null. With ELASTICEMAIL_WEBHOOK_SECRET set, the signature is required and the event is the
 * JSON body (POST) or the query string (GET); otherwise the ?token= shared secret is checked.
 */
const webhookEvent = (req) => {
  let event;
  if (webhookSecret) {
    const ok = verifySignature(
      webhookSecret,
      req.method,
      req.originalUrl,
      req.rawBody ?? "",
      req.get("X-ElasticEmail-Timestamp"),
      req.get("X-ElasticEmail-Signature"),
    );
    if (!ok) return null;
    event = req.method === "POST" ? (req.body ?? {}) : req.query;
  } else {
    if (!tokenOk(req.query.token)) return null;
    event = { ...req.query, ...(req.body ?? {}) };
  }
  return Object.fromEntries(Object.entries(event).map(([k, v]) => [k.toLowerCase(), v]));
};

const unauthorized = { error: webhookSecret ? "Invalid signature" : "Invalid token" };

const hmac = (value) => createHmac("sha256", secret).update(value).digest("hex");

const apiError = (err) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/send", async (req, res) => {
  const { to, subject, message } = req.body ?? {};

  if (!to || !subject || !message) {
    res.status(400).json({ error: "Missing required fields: to, subject, message" });
    return;
  }

  // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new key.
  const idempotencyKey = req.get("Idempotency-Key") || randomUUID();

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    }, idempotencyKey);
    res.json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    res.status(status).json({ error });
  }
});

// Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
// category, channel, target (clicked URL), ip, useragent, country, city.
// Signed webhooks (EnableSigning + DeliveryMethod PostJson) arrive as POST with a JSON body and
// X-ElasticEmail-* signature headers; unsigned ones as GET with the fields in the query string.
// Elastic Email sends a test event when the webhook is saved.
app.all("/webhook", (req, res) => {
  const event = webhookEvent(req);
  if (!event) {
    res.status(401).json(unauthorized);
    return;
  }

  const status = sanitize(event.status);

  if (!status) {
    // Validation ping or empty request
    res.json({ ok: true });
    return;
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

  res.json({ received: true, status });
});

// Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
app.post("/inbound", async (req, res) => {
  if (!tokenOk(req.query.token)) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const mail = req.body;
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
    res.json({ received: true, forwardedMessageId: data.MessageID });
  } catch (err) {
    const { status, message } = apiError(err);
    res.status(status).json({ error: message });
  }
});

app.post("/double-optin/subscribe", async (req, res) => {
  const { email, name = "" } = req.body ?? {};

  if (!email) {
    res.status(400).json({ error: "Missing required field: email" });
    return;
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

    res.json({ success: true, message: "Confirmation email sent", messageId: data.MessageID });
  } catch (err) {
    const { status, message } = apiError(err);
    res.status(status).json({ error: message });
  }
});

app.get("/double-optin/confirm", async (req, res) => {
  const email = String(req.query.email ?? "");
  const token = String(req.query.token ?? "");

  const expected = Buffer.from(hmac(email));
  const given = Buffer.from(token);
  if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    res.status(400).json({ error: "Invalid confirmation link" });
    return;
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [email] });
    if (confirmRedirectUrl) {
      res.redirect(confirmRedirectUrl);
      return;
    }
    res.json({ confirmed: true, email, list: listName });
  } catch (err) {
    const { status, message } = apiError(err);
    res.status(status).json({ error: message });
  }
});

// Click-tracking based confirmation: create a webhook for Clicked events pointing here.
app.all("/double-optin/webhook", async (req, res) => {
  const event = webhookEvent(req);
  if (!event) {
    res.status(401).json(unauthorized);
    return;
  }

  if (event.status !== "Clicked" || !String(event.target ?? "").includes("/double-optin/confirm")) {
    res.json({ received: true, status: sanitize(event.status), message: "Event ignored" });
    return;
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [event.to] });
    res.json({ received: true, confirmed: true, email: sanitize(event.to) });
  } catch (err) {
    const { status, message } = apiError(err);
    res.status(status).json({ error: message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Express server running on http://localhost:${port}`);
});
