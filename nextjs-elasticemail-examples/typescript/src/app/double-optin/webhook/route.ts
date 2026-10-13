// GET|POST /double-optin/webhook
//
// Click-tracking based confirmation. Create an Elastic Email webhook for Clicked events
// pointing at this URL. When the clicked link is the confirmation link, the recipient
// is added to the list. Signed webhooks (ELASTICEMAIL_WEBHOOK_SECRET) are verified with
// X-ElasticEmail-Signature, unsigned ones with ?token=. GET answers the URL validation ping.
import { NextResponse } from "next/server";
import { apiError, listName, listsApi, readWebhook, sanitize } from "@/lib/elasticemail";

async function handle(request: Request) {
  const event = await readWebhook(request);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature or token" }, { status: 401 });
  }

  if (event.status !== "Clicked" || !String(event.target ?? "").includes("/double-optin/confirm")) {
    return NextResponse.json({ received: true, status: sanitize(event.status), message: "Event ignored" });
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [event.to] });
    return NextResponse.json({ received: true, confirmed: true, email: sanitize(event.to) });
  } catch (err) {
    const { status, message } = apiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export const GET = handle;
export const POST = handle;
