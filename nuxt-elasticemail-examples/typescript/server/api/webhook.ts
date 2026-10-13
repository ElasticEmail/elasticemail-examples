// GET|POST /api/webhook
//
// Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
// category, channel, target (clicked URL), ip, useragent, country, city, ...
// Signed webhooks (created with EnableSigning + DeliveryMethod PostJson, ELASTICEMAIL_WEBHOOK_SECRET
// set) arrive as a POST with a JSON body and an X-ElasticEmail-Signature header, verified in
// readWebhook. Unsigned webhooks send the fields in the query string (GET) and are checked
// with the shared ?token= (ELASTICEMAIL_WEBHOOK_TOKEN) instead.
// Requests without a status (validation pings, test events) are answered 2xx.
// No method suffix in the file name, so this handler receives every method.
import { defineEventHandler } from "h3";
import { fail, readWebhook, sanitize } from "../utils/elasticemail";

export default defineEventHandler(async (event) => {
  if (event.method !== "GET" && event.method !== "POST") {
    return fail(event, 405, "Method not allowed");
  }

  const payload = await readWebhook(event);
  if (!payload) {
    return fail(event, 401, "Invalid signature or token");
  }

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
      console.log("Email opened from", sanitize(payload.country), sanitize(payload.city));
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
