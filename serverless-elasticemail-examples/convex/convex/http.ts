// HTTP actions run in Convex's default JavaScript runtime (no node:http, no node:crypto), so the
// Elastic Email SDK call lives in the Node action in email.ts and is invoked with ctx.runAction.
// Routes are served from https://<deployment>.convex.site
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time string compare (no node:crypto in this runtime) */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

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

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => json({ status: "ok" })),
});

http.route({
  path: "/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { to, subject, message } = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    if (typeof to !== "string" || typeof subject !== "string" || typeof message !== "string" || !to || !subject || !message) {
      return json({ error: "Missing required fields: to, subject, message" }, 400);
    }

    const result = await ctx.runAction(internal.email.send, { to, subject, message });
    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }
    return json({ success: true, transactionId: result.transactionId, messageId: result.messageId });
  }),
});

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
const webhook = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
  if (!safeEqual(url.searchParams.get("token") ?? "", secret)) {
    return json({ error: "Invalid token" }, 401);
  }

  const body = request.method === "POST" ? await readBody(request) : {};
  const event: Record<string, string> = { ...Object.fromEntries(url.searchParams), ...body };
  const status = sanitize(event.status);

  if (!status) {
    return json({ ok: true });
  }

  // To store events, call a mutation here: await ctx.runMutation(internal.events.record, { ... })
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
});

http.route({ path: "/webhook", method: "GET", handler: webhook });
http.route({ path: "/webhook", method: "POST", handler: webhook });

export default http;
