import { createHmac, timingSafeEqual } from "node:crypto";
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

      try {
        const { data } = await emailsApi.emailsTransactionalPost({
          Recipients: { To: [to] },
          Content: {
            From: from,
            Subject: subject,
            Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
          },
        });
        return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
      } catch (err) {
        const { status, message: error } = apiError(err);
        return json({ error }, status);
      }
    }

    // GET|POST /webhook
    // Elastic Email event notifications. Parameters arrive in the query string (GET) or as
    // form fields (POST): transaction, messageid, to, from, subject, date, status, category,
    // channel, target (clicked URL), IP, Useragent, Country, City.
    // Elastic Email sends a GET to validate the URL when the webhook is saved.
    if ((req.method === "GET" || req.method === "POST") && path === "/webhook") {
      if (!tokenOk(url.searchParams.get("token"))) {
        return json({ error: "Invalid token" }, 401);
      }

      const body = req.method === "POST" ? await readBody(req) : {};
      const event = { ...queryToObject(url), ...body };
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

    // POST /double-optin/webhook
    // Click-tracking based confirmation: create a webhook for Clicked events pointing here.
    if (req.method === "POST" && path === "/double-optin/webhook") {
      if (!tokenOk(url.searchParams.get("token"))) {
        return json({ error: "Invalid token" }, 401);
      }

      const event = { ...queryToObject(url), ...(await readBody(req)) };
      if (event.status !== "Clicked" || !String(event.target ?? "").includes("/double-optin/confirm")) {
        return json({ received: true, status: sanitize(event.status), message: "Event ignored" });
      }

      try {
        await listsApi.listsByNameContactsPost(listName, { Emails: [event.to] });
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
