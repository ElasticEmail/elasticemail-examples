// GET|POST /api/double-optin/webhook
//
// Click-tracking based confirmation. Create an Elastic Email webhook for Clicked events
// pointing at this URL. When the clicked link is the confirmation link, the recipient
// is added to the list. Signed webhooks (ELASTICEMAIL_WEBHOOK_SECRET) are verified with
// X-ElasticEmail-Signature, unsigned ones with ?token=. GET answers the URL validation ping.

import { apiError, json, listName, listsApi, readWebhook, sanitize } from "../../../lib/elasticemail";

async function handle(request) {
  const fields = await readWebhook(request);
  if (!fields) {
    return json({ error: "Invalid signature or token" }, 401);
  }

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

export const GET = ({ request }) => handle(request);
export const POST = ({ request }) => handle(request);
