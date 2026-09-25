import { timingSafeEqual } from "node:crypto";
import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Secrets are set with `encore secret set --type dev,local,pr,prod ElasticEmailApiKey`
// and resolved lazily by calling the function.
const elasticEmailApiKey = secret("ElasticEmailApiKey");
const webhookToken = secret("ElasticEmailWebhookToken");

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";

let emailsApi: EmailsApi | undefined;
function getEmailsApi(): EmailsApi {
  const apiKey = elasticEmailApiKey();
  if (!apiKey) {
    throw APIError.internal("ElasticEmailApiKey secret is not set. Run: encore secret set ElasticEmailApiKey");
  }
  emailsApi ??= new EmailsApi(new Configuration({ apiKey }));
  return emailsApi;
}

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time comparison of the shared secret carried in ?token= */
const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(webhookToken() || "change_me");
  return a.length === b.length && timingSafeEqual(a, b);
};

interface SendRequest {
  to: string;
  subject: string;
  message: string;
}

interface SendResponse {
  success: boolean;
  transactionId?: string;
  messageId?: string;
}

export const health = api(
  { method: "GET", path: "/health", expose: true },
  async (): Promise<{ status: string }> => ({ status: "ok" }),
);

export const send = api(
  { method: "POST", path: "/send", expose: true },
  async ({ to, subject, message }: SendRequest): Promise<SendResponse> => {
    if (!to || !subject || !message) {
      throw APIError.invalidArgument("Missing required fields: to, subject, message");
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
      return { success: true, transactionId: data.TransactionID, messageId: data.MessageID };
    } catch (err: any) {
      const status: number = err.response?.status ?? 500;
      const detail: string = err.response?.data?.Error ?? err.message ?? "Unknown error";
      // Map the Elastic Email error onto Encore's error codes. The v4 API reports a bad key
      // ("APIKey Expired") and a missing access level ("Access Denied.") as 400, not 401/403.
      if (status === 400 && /APIKey Expired|Access Denied/i.test(detail)) throw APIError.permissionDenied(detail);
      if (status === 400 || status === 412 || status === 413) throw APIError.invalidArgument(detail);
      if (status === 404) throw APIError.notFound(detail);
      throw APIError.internal(detail);
    }
  },
);

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
// A raw endpoint is used because the payload is form-encoded, not JSON.
export const webhook = api.raw(
  { method: ["GET", "POST"], path: "/webhook", expose: true },
  async (req, resp) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const reply = (status: number, body: unknown) => {
      resp.writeHead(status, { "Content-Type": "application/json" });
      resp.end(JSON.stringify(body));
    };

    if (!tokenOk(url.searchParams.get("token"))) {
      return reply(401, { error: "Invalid token" });
    }

    let body: Record<string, string> = {};
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString("utf8");
      const type = req.headers["content-type"] ?? "";
      if (type.includes("application/json") && raw) body = JSON.parse(raw);
      else if (type.includes("form")) body = Object.fromEntries(new URLSearchParams(raw));
    }

    const event: Record<string, string | undefined> = { ...Object.fromEntries(url.searchParams), ...body };
    const status = sanitize(event.status);

    if (!status) {
      return reply(200, { ok: true });
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

    reply(200, { received: true, status });
  },
);
