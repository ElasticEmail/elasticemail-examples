// GET|POST /.redwood/functions/webhook
//
// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email does not sign webhooks; the shared ?token= is checked instead.
// Elastic Email sends a GET to validate the URL when the webhook is saved, so GET must answer 2xx.

import { json, query, readEvent, sanitize, tokenOk } from "src/lib/elasticemail";

export const handler = async (event, _context) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!tokenOk(query(event).get("token"))) {
    return json({ error: "Invalid token" }, 401);
  }

  const fields = await readEvent(event);
  const status = sanitize(fields.status);

  if (!status) {
    // Validation ping or empty request
    return json({ ok: true });
  }

  console.log("Webhook event:", status, "to:", sanitize(fields.to), "transaction:", sanitize(fields.transaction));

  switch (status) {
    case "Sent":
      console.log("Email sent, message id:", sanitize(fields.messageid));
      break;
    case "Opened":
      console.log("Email opened from", sanitize(fields.Country), sanitize(fields.City));
      break;
    case "Clicked":
      console.log("Link clicked:", sanitize(fields.target));
      break;
    case "Error":
      console.log("Bounce/error, category:", sanitize(fields.category));
      break;
    case "AbuseReport":
      console.log("Complaint received");
      break;
    case "Unsubscribed":
      console.log("Recipient unsubscribed");
      break;
  }

  return json({ received: true, status });
};
