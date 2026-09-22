// GET|POST /api/double-optin/webhook
//
// Click-tracking based confirmation. Create an Elastic Email webhook for Clicked events
// pointing at this URL. When the clicked link is the confirmation link, the recipient
// is added to the list. GET answers the URL validation ping.
import type { APIRoute } from "astro";
import { apiError, json, listName, listsApi, query, readEvent, sanitize, tokenOk } from "../../../lib/elasticemail";

async function handle(request: Request) {
  if (!tokenOk(query(request).get("token"))) {
    return json({ error: "Invalid token" }, 401);
  }

  const fields = await readEvent(request);
  if (fields.status !== "Clicked" || !String(fields.target ?? "").includes("/api/double-optin/confirm")) {
    return json({ received: true, status: sanitize(fields.status), message: "Event ignored" });
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [fields.to] });
    return json({ received: true, confirmed: true, email: sanitize(fields.to) });
  } catch (err) {
    const { status, message } = apiError(err);
    return json({ error: message }, status);
  }
}

export const GET: APIRoute = ({ request }) => handle(request);
export const POST: APIRoute = ({ request }) => handle(request);
