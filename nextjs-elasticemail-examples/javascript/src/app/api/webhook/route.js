// GET|POST /api/webhook
//
// Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
// category, channel, target (clicked URL), ip, useragent, country, city, ...
// Signed webhooks (created with EnableSigning + DeliveryMethod PostJson, ELASTICEMAIL_WEBHOOK_SECRET
// set) arrive as a POST with a JSON body and an X-ElasticEmail-Signature header, verified in
// readWebhook. Unsigned webhooks send the fields in the query string (GET) and are checked
// with the shared ?token= (ELASTICEMAIL_WEBHOOK_TOKEN) instead.
// Requests without a status (validation pings, test events) are answered 2xx.
import { NextResponse } from "next/server";
import { readWebhook, sanitize } from "@/lib/elasticemail";

async function handle(request) {
  const event = await readWebhook(request);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature or token" }, { status: 401 });
  }

  const status = sanitize(event.status);

  if (!status) {
    // Validation ping or empty request
    return NextResponse.json({ ok: true });
  }

  console.log("Webhook event:", status, "to:", sanitize(event.to), "transaction:", sanitize(event.transaction));

  switch (status) {
    case "Sent":
      console.log("Email sent, message id:", sanitize(event.messageid));
      break;
    case "Opened":
      console.log("Email opened from", sanitize(event.country), sanitize(event.city));
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

  return NextResponse.json({ received: true, status });
}

export const GET = handle;
export const POST = handle;
