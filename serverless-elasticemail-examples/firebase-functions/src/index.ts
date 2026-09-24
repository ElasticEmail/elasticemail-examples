import { timingSafeEqual } from "node:crypto";
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// Secrets live in Cloud Secret Manager: firebase functions:secrets:set ELASTICEMAIL_API_KEY
// Locally the emulator reads them from .secret.local.
const apiKey = defineSecret("ELASTICEMAIL_API_KEY");
const webhookToken = defineSecret("ELASTICEMAIL_WEBHOOK_TOKEN");
// Plain parameter, read from .env (deploy prompts for it if missing).
const emailFrom = defineString("EMAIL_FROM", { default: "Acme <hello@yourdomain.com>" });

let emailsApi: EmailsApi | undefined;
function getEmailsApi(): EmailsApi {
  const key = apiKey.value();
  if (!key) {
    throw new Error("ELASTICEMAIL_API_KEY is not set. Run: firebase functions:secrets:set ELASTICEMAIL_API_KEY");
  }
  // Reused across invocations on a warm instance
  emailsApi ??= new EmailsApi(new Configuration({ apiKey: key }));
  return emailsApi;
}

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(webhookToken.value() || "change_me");
  return a.length === b.length && timingSafeEqual(a, b);
};

const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

async function sendEmail(to: string, subject: string, message: string) {
  const { data } = await getEmailsApi().emailsTransactionalPost({
    Recipients: { To: [to] },
    Content: {
      From: emailFrom.value(),
      Subject: subject,
      Body: [
        { ContentType: "HTML", Content: `<p>${message}</p>` },
        { ContentType: "PlainText", Content: message },
      ],
    },
  });
  return { transactionId: data.TransactionID, messageId: data.MessageID };
}

/**
 * HTTP function with three routes: GET /health, POST /send, GET|POST /webhook.
 * Deployed at https://us-central1-<project>.cloudfunctions.net/api
 */
export const api = onRequest({ secrets: [apiKey, webhookToken] }, async (req, res) => {
  const path = req.path;

  if (req.method === "GET" && path === "/health") {
    res.json({ status: "ok" });
    return;
  }

  if (req.method === "POST" && path === "/send") {
    // Firebase parses JSON and form bodies before the handler runs.
    const { to, subject, message } = (req.body ?? {}) as Record<string, string>;
    if (!to || !subject || !message) {
      res.status(400).json({ error: "Missing required fields: to, subject, message" });
      return;
    }

    try {
      res.json({ success: true, ...(await sendEmail(to, subject, message)) });
    } catch (err) {
      const { status, message: error } = apiError(err);
      res.status(status).json({ error });
    }
    return;
  }

  // Elastic Email event notifications. Parameters arrive in the query string (GET) or as
  // form fields (POST): transaction, messageid, to, from, subject, date, status, category,
  // channel, target (clicked URL), IP, Useragent, Country, City.
  // Elastic Email sends a GET to validate the URL when the webhook is saved.
  if ((req.method === "GET" || req.method === "POST") && path === "/webhook") {
    if (!tokenOk(req.query.token)) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const body = req.method === "POST" && typeof req.body === "object" ? req.body : {};
    const event: Record<string, unknown> = { ...req.query, ...body };
    const status = sanitize(event.status);

    if (!status) {
      res.json({ ok: true });
      return;
    }

    logger.info("Webhook event:", status, "to:", sanitize(event.to), "transaction:", sanitize(event.transaction));
    switch (status) {
      case "Sent":
        logger.info("Email sent, message id:", sanitize(event.messageid));
        break;
      case "Opened":
        logger.info("Email opened from", sanitize(event.Country), sanitize(event.City));
        break;
      case "Clicked":
        logger.info("Link clicked:", sanitize(event.target));
        break;
      case "Error":
        logger.info("Bounce/error, category:", sanitize(event.category));
        break;
      case "AbuseReport":
        logger.info("Complaint received");
        break;
      case "Unsubscribed":
        logger.info("Recipient unsubscribed");
        break;
    }

    res.json({ received: true, status });
    return;
  }

  res.status(404).json({ error: "Not found" });
});

/**
 * Callable function for Flutter, iOS, Android and web apps using the Firebase SDK.
 * The caller must be signed in with a verified email address, and the message goes to that
 * address only, so a leaked app build cannot be used to send mail to anyone else.
 */
export const sendEmailToMe = onCall(
  // Set enforceAppCheck: true once App Check is set up in your app.
  { secrets: [apiKey], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in first");
    }
    const email = request.auth.token.email;
    if (!email || !request.auth.token.email_verified) {
      throw new HttpsError("failed-precondition", "The signed-in user has no verified email address");
    }

    const { subject, message } = (request.data ?? {}) as { subject?: string; message?: string };
    if (!subject || !message) {
      throw new HttpsError("invalid-argument", "Missing required fields: subject, message");
    }

    try {
      return { success: true, ...(await sendEmail(email, subject, message)) };
    } catch (err) {
      const { status, message: error } = apiError(err);
      logger.error("Elastic Email send failed", status, error);
      throw new HttpsError("internal", error);
    }
  },
);
