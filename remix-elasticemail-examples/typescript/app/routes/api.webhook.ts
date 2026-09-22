// GET|POST /api/webhook?token=...
//
// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email does not sign webhooks; the shared ?token= is checked instead.
// Elastic Email sends a GET to validate the URL when the webhook is saved, so GET must answer 2xx.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { readEvent, sanitize, tokenOk } from "../lib/elasticemail.server";

async function handle(request: Request) {
  const url = new URL(request.url);
  if (!tokenOk(url.searchParams.get("token"))) {
    return json({ error: "Invalid token" }, { status: 401 });
  }

  const event = await readEvent(request);
  const status = sanitize(event.status);

  if (!status) {
    // Validation ping or empty request
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

export const loader = ({ request }: LoaderFunctionArgs) => handle(request);
export const action = ({ request }: ActionFunctionArgs) => handle(request);
