// GET|POST /api/webhook?token=...
//
// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email does not sign webhooks; the shared ?token= is checked instead.
// Elastic Email sends a GET to validate the URL when the webhook is saved, so GET must answer 2xx.
// No method suffix in the file name, so this handler receives every method.
import { defineEventHandler, getQuery } from "h3";
import { fail, readEvent, sanitize, tokenOk } from "../utils/elasticemail";

export default defineEventHandler(async (event) => {
  if (event.method !== "GET" && event.method !== "POST") {
    return fail(event, 405, "Method not allowed");
  }

  if (!tokenOk(getQuery(event).token)) {
    return fail(event, 401, "Invalid token");
  }

  const payload = await readEvent(event);
  const status = sanitize(payload.status);

  if (!status) {
    // Validation ping or empty request
    return { ok: true };
  }

  console.log("Webhook event:", status, "to:", sanitize(payload.to), "transaction:", sanitize(payload.transaction));

  switch (status) {
    case "Sent":
      console.log("Email sent, message id:", sanitize(payload.messageid));
      break;
    case "Opened":
      console.log("Email opened from", sanitize(payload.Country), sanitize(payload.City));
      break;
    case "Clicked":
      console.log("Link clicked:", sanitize(payload.target));
      break;
    case "Error":
      console.log("Bounce/error, category:", sanitize(payload.category));
      break;
    case "AbuseReport":
      console.log("Complaint received");
      break;
    case "Unsubscribed":
      console.log("Recipient unsubscribed");
      break;
  }

  return { received: true, status };
});
