import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { readBody, sanitize, tokenOk, verifySignature } from "../lib.js";

// Elastic Email event notifications. A signed webhook created with DeliveryMethod PostJson
// POSTs a flat JSON object; an unsigned one sends a GET with the same fields in the query string:
// transaction, messageid, to, from, subject, date, status, category, channel, target (clicked URL),
// ip, useragent, country, state, city. to/from/channel/subject/messageid may be null.
export async function webhook(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Signing secret (whsec_...) returned once when the webhook is created with EnableSigning.
  const signingSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET;
  let event: Record<string, unknown>;

  if (signingSecret) {
    // Verify the raw body and the raw path + query (new URL keeps the percent-encoding) before parsing.
    const raw = await req.text();
    const url = new URL(req.url);
    const ok = verifySignature(
      signingSecret,
      req.headers.get("x-elasticemail-timestamp"),
      req.headers.get("x-elasticemail-signature"),
      req.method,
      url.pathname + url.search,
      raw,
    );
    if (!ok) {
      // 401 makes Elastic Email retry. The test event sent when the webhook is created
      // arrives before you know the secret; Elastic Email accepts a 401 for that one.
      return { status: 401, jsonBody: { error: "Invalid signature" } };
    }
    try {
      event = req.method === "POST" ? (JSON.parse(raw || "{}") ?? {}) : Object.fromEntries(req.query);
    } catch {
      return { status: 400, jsonBody: { error: "Invalid JSON body" } };
    }
  } else {
    // Unsigned webhook: the shared secret travels in the URL as ?token=
    if (!tokenOk(req.query.get("token"))) {
      return { status: 401, jsonBody: { error: "Invalid token" } };
    }
    const body = req.method === "POST" ? await readBody(req) : {};
    event = { ...Object.fromEntries(req.query), ...body };
  }

  const status = sanitize(event.status);

  if (!status) {
    return { jsonBody: { ok: true } };
  }

  context.log("Webhook event:", status, "to:", sanitize(event.to), "transaction:", sanitize(event.transaction));
  switch (status) {
    case "Sent":
      context.log("Email sent, message id:", sanitize(event.messageid));
      break;
    case "Opened":
      context.log("Email opened from", sanitize(event.country ?? event.Country), sanitize(event.city ?? event.City));
      break;
    case "Clicked":
      context.log("Link clicked:", sanitize(event.target));
      break;
    case "Error":
      context.log("Bounce/error, category:", sanitize(event.category));
      break;
    case "AbuseReport":
      context.log("Complaint received");
      break;
    case "Unsubscribed":
      context.log("Recipient unsubscribed");
      break;
  }

  return { jsonBody: { received: true, status } };
}

app.http("webhook", {
  methods: ["GET", "POST"],
  // Elastic Email cannot send a function key, so the signature (or ?token=) check is the protection here.
  authLevel: "anonymous",
  route: "webhook",
  handler: webhook,
});
