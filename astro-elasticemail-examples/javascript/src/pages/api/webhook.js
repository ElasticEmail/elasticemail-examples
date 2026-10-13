// GET|POST /api/webhook
//
// Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
// category, channel, target (clicked URL), ip, useragent, country, city, ...
// Signed webhooks (created with EnableSigning + DeliveryMethod PostJson, ELASTICEMAIL_WEBHOOK_SECRET
// set) arrive as a POST with a JSON body and an X-ElasticEmail-Signature header, verified in
// readWebhook. Unsigned webhooks send the fields in the query string (GET) and are checked
// with the shared ?token= (ELASTICEMAIL_WEBHOOK_TOKEN) instead.
// Requests without a status (validation pings, test events) are answered 2xx.

import { json, readWebhook, sanitize } from "../../lib/elasticemail";

async function handle(request) {
  const fields = await readWebhook(request);
  if (!fields) {
    return json({ error: "Invalid signature or token" }, 401);
  }

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
      console.log("Email opened from", sanitize(fields.country), sanitize(fields.city));
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

export const GET = ({ request }) => handle(request);
export const POST = ({ request }) => handle(request);
