import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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
// Signing secret (whsec_...) returned once when the webhook is created with EnableSigning.
// Secret Manager cannot store an empty value, so set it to "none" to keep the ?token= check.
const webhookSecret = defineSecret("ELASTICEMAIL_WEBHOOK_SECRET");
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

/**
 * Verify an Elastic Email webhook signature:
 * X-ElasticEmail-Signature: v1=hex(HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${target}\n${rawBody}`)),
 * where target is the path + query exactly as requested (still URL-encoded).
 */
function verifySignature(
  key: string,
  timestamp: string | undefined,
  signatureHeader: string | undefined,
  method: string,
  target: string,
  body: Buffer | string,
): boolean {
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = Buffer.from(
    createHmac("sha256", key).update(`${timestamp}\n${method}\n${target}\n`).update(body).digest("hex"),
  );
  return (signatureHeader ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .some((part) => {
      const candidate = Buffer.from(part.slice(3));
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
}

const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

// Pass the same idempotencyKey only to retry the same send; a new key is generated otherwise.
async function sendEmail(to: string, subject: string, message: string, idempotencyKey: string = randomUUID()) {
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
  }, idempotencyKey);
  return { transactionId: data.TransactionID, messageId: data.MessageID };
}

/**
 * HTTP function with three routes: GET /health, POST /send, GET|POST /webhook.
 * Deployed at https://us-central1-<project>.cloudfunctions.net/api
 */
export const api = onRequest({ secrets: [apiKey, webhookToken, webhookSecret] }, async (req, res) => {
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

    // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new one.
    const idempotencyKey = req.get("idempotency-key") || randomUUID();

    try {
      res.json({ success: true, ...(await sendEmail(to, subject, message, idempotencyKey)) });
    } catch (err) {
      const { status, message: error } = apiError(err);
      res.status(status).json({ error });
    }
    return;
  }

  // Elastic Email event notifications. A signed webhook created with DeliveryMethod PostJson
  // POSTs a flat JSON object; an unsigned one sends a GET with the same fields in the query string:
  // transaction, messageid, to, from, subject, date, status, category, channel, target (clicked URL),
  // ip, useragent, country, state, city. to/from/channel/subject/messageid may be null.
  if ((req.method === "GET" || req.method === "POST") && path === "/webhook") {
    const signingSecret = webhookSecret.value();
    let event: Record<string, unknown>;

    if (signingSecret && signingSecret !== "none") {
      // Firebase parses the body before the handler runs but keeps the original bytes in req.rawBody.
      // req.originalUrl is the path + query as requested, still URL-encoded. On the cloudfunctions.net
      // URL the function name (/api) is stripped before the request reaches the handler, so check both forms.
      const raw = req.rawBody ?? Buffer.alloc(0);
      const ok = [req.originalUrl, `/api${req.originalUrl}`].some((target) =>
        verifySignature(
          signingSecret,
          req.get("x-elasticemail-timestamp"),
          req.get("x-elasticemail-signature"),
          req.method,
          target,
          raw,
        ),
      );
      if (!ok) {
        // 401 makes Elastic Email retry. The test event sent when the webhook is created
        // arrives before you know the secret; Elastic Email accepts a 401 for that one.
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      try {
        event = req.method === "POST" ? (JSON.parse(raw.toString("utf8") || "{}") ?? {}) : req.query;
      } catch {
        res.status(400).json({ error: "Invalid JSON body" });
        return;
      }
    } else {
      // Unsigned webhook: the shared secret travels in the URL as ?token=
      if (!tokenOk(req.query.token)) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      const body = req.method === "POST" && typeof req.body === "object" ? req.body : {};
      event = { ...req.query, ...body };
    }

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
        logger.info("Email opened from", sanitize(event.country ?? event.Country), sanitize(event.city ?? event.City));
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
