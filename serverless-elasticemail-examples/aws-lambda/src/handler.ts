import { timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";

let emailsApi: EmailsApi | undefined;
function getEmailsApi(): EmailsApi {
  if (!process.env.ELASTICEMAIL_API_KEY) {
    throw new Error("ELASTICEMAIL_API_KEY is not set. Pass ElasticEmailApiKey to `sam deploy`");
  }
  // Reused across warm invocations
  emailsApi ??= new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));
  return emailsApi;
}

type Result = Exclude<APIGatewayProxyResultV2, string>;

const json = (data: unknown, statusCode = 200): Result => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

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

/** API Gateway base64-encodes binary-looking bodies; form posts from Elastic Email often arrive that way. */
const rawBody = (event: APIGatewayProxyEventV2): string =>
  event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) : "";

/** Elastic Email webhooks are form-encoded; JSON is accepted too. */
function readBody(event: APIGatewayProxyEventV2): Record<string, string> {
  const type = event.headers["content-type"] ?? event.headers["Content-Type"] ?? "";
  const body = rawBody(event);
  if (!body) return {};
  if (type.includes("application/json")) return JSON.parse(body);
  if (type.includes("form")) return Object.fromEntries(new URLSearchParams(body));
  return {};
}

export async function handler(event: APIGatewayProxyEventV2): Promise<Result> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const query = event.queryStringParameters ?? {};

  if (method === "GET" && path === "/health") {
    return json({ status: "ok" });
  }

  if (method === "POST" && path === "/send") {
    let payload: Record<string, string> = {};
    try {
      payload = JSON.parse(rawBody(event) || "{}");
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { to, subject, message } = payload;
    if (!to || !subject || !message) {
      return json({ error: "Missing required fields: to, subject, message" }, 400);
    }

    try {
      const { data } = await getEmailsApi().emailsTransactionalPost({
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

  // Elastic Email event notifications. Parameters arrive in the query string (GET) or as
  // form fields (POST): transaction, messageid, to, from, subject, date, status, category,
  // channel, target (clicked URL), IP, Useragent, Country, City.
  // Elastic Email sends a GET to validate the URL when the webhook is saved.
  if ((method === "GET" || method === "POST") && path === "/webhook") {
    if (!tokenOk(query.token)) {
      return json({ error: "Invalid token" }, 401);
    }

    const body = method === "POST" ? readBody(event) : {};
    const evt: Record<string, string | undefined> = { ...query, ...body };
    const status = sanitize(evt.status);

    if (!status) {
      return json({ ok: true });
    }

    console.log("Webhook event:", status, "to:", sanitize(evt.to), "transaction:", sanitize(evt.transaction));
    switch (status) {
      case "Sent":
        console.log("Email sent, message id:", sanitize(evt.messageid));
        break;
      case "Opened":
        console.log("Email opened from", sanitize(evt.Country), sanitize(evt.City));
        break;
      case "Clicked":
        console.log("Link clicked:", sanitize(evt.target));
        break;
      case "Error":
        console.log("Bounce/error, category:", sanitize(evt.category));
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

  return json({ error: "Not found" }, 404);
}
