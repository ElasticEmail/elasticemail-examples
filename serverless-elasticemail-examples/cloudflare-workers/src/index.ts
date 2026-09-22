import axios from "axios";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

export interface Env {
  ELASTICEMAIL_API_KEY: string;
  ELASTICEMAIL_WEBHOOK_TOKEN: string;
  EMAIL_FROM: string;
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time string compare (no node:crypto needed) */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const apiError = (err: any) => ({
  status: err.response?.status ?? 500,
  message: err.response?.data?.Error ?? err.message ?? "Unknown error",
});

/** Elastic Email webhooks are form-encoded; JSON is accepted too. */
async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return await req.json();
  if (type.includes("form")) {
    const out: Record<string, string> = {};
    (await req.formData()).forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  }
  return {};
}

function emailsApi(env: Env): EmailsApi {
  if (!env.ELASTICEMAIL_API_KEY) {
    throw new Error("ELASTICEMAIL_API_KEY is not set. Run: wrangler secret put ELASTICEMAIL_API_KEY");
  }
  const config = new Configuration({ apiKey: env.ELASTICEMAIL_API_KEY });
  // workerd has no node:http, so axios must use its fetch adapter.
  return new EmailsApi(config, undefined, axios.create({ adapter: "fetch" }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && path === "/health") {
      return json({ status: "ok" });
    }

    if (request.method === "POST" && path === "/send") {
      const { to, subject, message } = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, string>;
      if (!to || !subject || !message) {
        return json({ error: "Missing required fields: to, subject, message" }, 400);
      }

      try {
        const { data } = await emailsApi(env).emailsTransactionalPost({
          Recipients: { To: [to] },
          Content: {
            From: env.EMAIL_FROM || "Acme <hello@yourdomain.com>",
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
    if ((request.method === "GET" || request.method === "POST") && path === "/webhook") {
      const secret = env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
      if (!safeEqual(url.searchParams.get("token") ?? "", secret)) {
        return json({ error: "Invalid token" }, 401);
      }

      const body = request.method === "POST" ? await readBody(request) : {};
      const event = { ...Object.fromEntries(url.searchParams), ...body };
      const status = sanitize(event.status);

      if (!status) {
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

    return json({ error: "Not found" }, 404);
  },
};
