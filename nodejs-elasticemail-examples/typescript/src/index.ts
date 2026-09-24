import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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
const confirmRedirectUrl = process.env.CONFIRM_REDIRECT_URL;

// Inbound email carries base64 attachments in form fields
const MAX_BODY_BYTES = 25 * 1024 * 1024;

type Fields = Record<string, string>;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

const hmac = (value: string) => createHmac("sha256", secret).update(value).digest("hex");

const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Read the request body and parse it as JSON or as a form (webhooks and inbound are form-encoded) */
const readBody = async (req: IncomingMessage): Promise<Fields> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  const type = req.headers["content-type"] ?? "";
  if (type.includes("application/json")) {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
};

const send = async (res: ServerResponse, body: Fields) => {
  const { to, subject, message } = body;

  if (!to || !subject || !message) {
    sendJson(res, 400, { error: "Missing required fields: to, subject, message" });
    return;
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
    sendJson(res, 200, { success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    sendJson(res, status, { error });
  }
};

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
const webhook = (res: ServerResponse, event: Fields) => {
  if (!tokenOk(event.token)) {
    sendJson(res, 401, { error: "Invalid token" });
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
      console.log("Email opened from", sanitize(event.Country), sanitize(event.City));
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
const inbound = async (res: ServerResponse, token: string | null, mail: Fields) => {
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

const subscribe = async (res: ServerResponse, body: Fields) => {
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

const confirm = async (res: ServerResponse, query: URLSearchParams) => {
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
const optinWebhook = async (res: ServerResponse, event: Fields) => {
  if (!tokenOk(event.token)) {
    sendJson(res, 401, { error: "Invalid token" });
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
    const body = method === "GET" || method === "HEAD" ? {} : await readBody(req);
    // Webhook parameters can arrive in either place; the query string wins for ?token=
    const event = { ...body, ...Object.fromEntries(query) };

    switch (`${method} ${url.pathname}`) {
      case "GET /health":
        return sendJson(res, 200, { status: "ok" });
      case "POST /send":
        return await send(res, body);
      case "GET /webhook":
      case "POST /webhook":
        return webhook(res, event);
      case "POST /inbound":
        return await inbound(res, query.get("token"), body);
      case "POST /double-optin/subscribe":
        return await subscribe(res, body);
      case "GET /double-optin/confirm":
        return await confirm(res, query);
      case "GET /double-optin/webhook":
      case "POST /double-optin/webhook":
        return await optinWebhook(res, event);
      default:
        return sendJson(res, 404, { error: "Not found" });
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    sendJson(res, status, { error: (err as Error).message });
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Node.js server running on http://localhost:${port}`);
});
