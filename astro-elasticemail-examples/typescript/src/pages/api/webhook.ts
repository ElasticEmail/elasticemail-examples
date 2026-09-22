// GET|POST /api/webhook
//
// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email does not sign webhooks; the shared ?token= is checked instead.
// Elastic Email sends a GET to validate the URL when the webhook is saved, so GET must answer 2xx.
import type { APIRoute } from "astro";
import { json, query, readEvent, sanitize, tokenOk } from "../../lib/elasticemail";

async function handle(request: Request) {
  if (!tokenOk(query(request).get("token"))) {
    return json({ error: "Invalid token" }, 401);
  }

  const fields = await readEvent(request);
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
}

export const GET: APIRoute = ({ request }) => handle(request);
export const POST: APIRoute = ({ request }) => handle(request);
