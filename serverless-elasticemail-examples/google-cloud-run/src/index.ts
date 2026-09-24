import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

if (!process.env.ELASTICEMAIL_API_KEY) {
  console.error("ELASTICEMAIL_API_KEY is not set. Deploy with --set-secrets ELASTICEMAIL_API_KEY=elasticemail-api-key:latest");
  process.exit(1);
}

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";

const app = new Hono();

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

/** Elastic Email webhooks are form-encoded; JSON is accepted too. */
const readBody = async (c: any): Promise<Record<string, string>> => {
  const type = c.req.header("content-type") ?? "";
  if (type.includes("application/json")) return await c.req.json();
  if (type.includes("form")) {
    const body = await c.req.parseBody();
    return Object.fromEntries(
      Object.entries(body).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
  }
  return {};
};

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/send", async (c) => {
  const { to, subject, message } = (await c.req.json().catch(() => ({}))) ?? {};

  if (!to || !subject || !message) {
    return c.json({ error: "Missing required fields: to, subject, message" }, 400);
  }

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [
          { ContentType: "HTML", Content: `<p>${message}</p>` },
          { ContentType: "PlainText", Content: message },
        ],
      },
    });
    return c.json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return c.json({ error }, status);
  }
});

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
app.on(["GET", "POST"], "/webhook", async (c) => {
  if (!tokenOk(c.req.query("token"))) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const body = c.req.method === "POST" ? await readBody(c) : {};
  const event = { ...c.req.query(), ...body };
  const status = sanitize(event.status);

  if (!status) {
    return c.json({ ok: true });
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

  return c.json({ received: true, status });
});

// Cloud Run injects PORT (8080 unless you change it); bind to 0.0.0.0 so its proxy can reach the container.
const port = Number(process.env.PORT) || 8080;
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
