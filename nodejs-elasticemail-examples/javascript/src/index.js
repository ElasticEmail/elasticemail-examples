import "dotenv/config";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
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

// Inbound email carries base64 attachments in form fields
const MAX_BODY_BYTES = 25 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

const sendJson = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Read the raw request body (kept as-is: webhook signatures are computed over it) */
const readRawBody = async (req) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

/** Parse the body as JSON or as a form (unsigned webhooks and inbound are form-encoded) */
const parseBody = (raw, contentType = "") => {
  if (!raw) return {};
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
};

/**
 * Authenticate an Elastic Email webhook request and return its event fields (keys lowercased),
 * or null. With ELASTICEMAIL_WEBHOOK_SECRET set, the signature is required and the event is the
 * JSON body (POST) or the query string (GET); otherwise the ?token= shared secret is checked.
 */
const webhookEvent = (
  req,
  rawBody,
  query,
  body,
) => {
  let event;
  if (webhookSecret) {
    const ok = verifySignature(
      webhookSecret,
      req.method ?? "GET",
      req.url ?? "/", // path + query exactly as on the request line
      rawBody,
      req.headers["x-elasticemail-timestamp"],
      req.headers["x-elasticemail-signature"],
    );
    if (!ok) return null;
    event = req.method === "POST" ? body : Object.fromEntries(query);
  } else {
    // Parameters can arrive in either place; the query string wins for ?token=
    const fields = { ...body, ...Object.fromEntries(query) };
    if (!tokenOk(fields.token)) return null;
    event = fields;
  }
  return Object.fromEntries(Object.entries(event).map(([k, v]) => [k.toLowerCase(), v]));
};

const unauthorized = { error: webhookSecret ? "Invalid signature" : "Invalid token" };

const send = async (res, body, clientKey) => {
  const { to, subject, message } = body;

  if (!to || !subject || !message) {
    sendJson(res, 400, { error: "Missing required fields: to, subject, message" });
    return;
  }

  // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new key.
  const idempotencyKey = clientKey || randomUUID();

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    }, idempotencyKey);
    sendJson(res, 200, { success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    sendJson(res, status, { error });
  }
};

// Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
// category, channel, target (clicked URL), ip, useragent, country, city.
// Signed webhooks (EnableSigning + DeliveryMethod PostJson) arrive as POST with a JSON body and
// X-ElasticEmail-* signature headers; unsigned ones as GET with the fields in the query string.
// Elastic Email sends a test event when the webhook is saved.
const webhook = (res, event) => {
  if (!event) {
    sendJson(res, 401, unauthorized);
    return;
  }

  const status = sanitize(event.status);

  if (!status) {
    // Validation ping or empty request
    sendJson(res, 200, { ok: true });
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

  sendJson(res, 200, { received: true, status });
};

// Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
const inbound = async (res, token, mail) => {
  if (!tokenOk(token)) {
    sendJson(res, 401, { error: "Invalid token" });
    return;
  }

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
    sendJson(res, 200, { received: true, forwardedMessageId: data.MessageID });
  } catch (err) {
    const { status, message } = apiError(err);
    sendJson(res, status, { error: message });
  }
};

const subscribe = async (res, body) => {
  const { email, name = "" } = body;

  if (!email) {
    sendJson(res, 400, { error: "Missing required field: email" });
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

    sendJson(res, 200, { success: true, message: "Confirmation email sent", messageId: data.MessageID });
  } catch (err) {
    const { status, message } = apiError(err);
    sendJson(res, status, { error: message });
  }
};

const confirm = async (res, query) => {
  const email = query.get("email") ?? "";
  const token = query.get("token") ?? "";

  const expected = Buffer.from(hmac(email));
  const given = Buffer.from(token);
  if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    sendJson(res, 400, { error: "Invalid confirmation link" });
    return;
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [email] });
    if (confirmRedirectUrl) {
      res.writeHead(302, { Location: confirmRedirectUrl });
      res.end();
      return;
    }
    sendJson(res, 200, { confirmed: true, email, list: listName });
  } catch (err) {
    const { status, message } = apiError(err);
    sendJson(res, status, { error: message });
  }
};

// Click-tracking based confirmation: create a webhook for Clicked events pointing here.
const optinWebhook = async (res, event) => {
  if (!event) {
    sendJson(res, 401, unauthorized);
    return;
  }

  if (event.status !== "Clicked" || !String(event.target ?? "").includes("/double-optin/confirm")) {
    sendJson(res, 200, { received: true, status: sanitize(event.status), message: "Event ignored" });
    return;
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [event.to] });
    sendJson(res, 200, { received: true, confirmed: true, email: sanitize(event.to) });
  } catch (err) {
    const { status, message } = apiError(err);
    sendJson(res, status, { error: message });
  }
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const query = url.searchParams;
  const method = req.method ?? "GET";

  try {
    const rawBody = method === "GET" || method === "HEAD" ? "" : await readRawBody(req);
    const body = parseBody(rawBody, req.headers["content-type"]);

    switch (`${method} ${url.pathname}`) {
      case "GET /health":
        return sendJson(res, 200, { status: "ok" });
      case "POST /send":
        return await send(res, body, req.headers["idempotency-key"]?.toString());
      case "GET /webhook":
      case "POST /webhook":
        return webhook(res, webhookEvent(req, rawBody, query, body));
      case "POST /inbound":
        return await inbound(res, query.get("token"), body);
      case "POST /double-optin/subscribe":
        return await subscribe(res, body);
      case "GET /double-optin/confirm":
        return await confirm(res, query);
      case "GET /double-optin/webhook":
      case "POST /double-optin/webhook":
        return await optinWebhook(res, webhookEvent(req, rawBody, query, body));
      default:
        return sendJson(res, 404, { error: "Not found" });
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    sendJson(res, status, { error: err.message });
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Node.js server running on http://localhost:${port}`);
});
