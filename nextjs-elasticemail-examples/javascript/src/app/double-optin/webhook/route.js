// GET|POST /double-optin/webhook?token=...
//
// Click-tracking based confirmation. Create an Elastic Email webhook for Clicked events
// pointing at this URL. When the clicked link is the confirmation link, the recipient
// is added to the list. GET answers the URL validation ping.
import { NextResponse } from "next/server";
import { apiError, listName, listsApi, readEvent, sanitize, tokenOk } from "@/lib/elasticemail";

async function handle(request) {
  const url = new URL(request.url);
  if (!tokenOk(url.searchParams.get("token"))) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const event = await readEvent(request);
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
