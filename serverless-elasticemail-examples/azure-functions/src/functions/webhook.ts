import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { readBody, sanitize, tokenOk } from "../lib.js";

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
export async function webhook(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!tokenOk(req.query.get("token"))) {
    return { status: 401, jsonBody: { error: "Invalid token" } };
  }

  const body = req.method === "POST" ? await readBody(req) : {};
  const event: Record<string, string> = { ...Object.fromEntries(req.query), ...body };
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
      context.log("Email opened from", sanitize(event.Country), sanitize(event.City));
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
  // Elastic Email cannot send a function key, so the ?token= check is the protection here.
  authLevel: "anonymous",
  route: "webhook",
  handler: webhook,
});
