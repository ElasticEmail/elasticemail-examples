// POST /api/double-optin/webhook
//
// Click-tracking based confirmation. Create an Elastic Email webhook for Clicked events
// pointing at this URL. When the clicked link is the confirmation link, the recipient
// is added to the list. Signed webhooks (ELASTICEMAIL_WEBHOOK_SECRET) are verified with
// X-ElasticEmail-Signature, unsigned ones with ?token=. GET is answered by webhook.get.ts.
import { defineEventHandler } from "h3";
import { apiError, fail, listName, listsApi, readWebhook, sanitize } from "../../utils/elasticemail";

export default defineEventHandler(async (event) => {
  const payload = await readWebhook(event);
  if (!payload) {
    return fail(event, 401, "Invalid signature or token");
  }

  if (payload.status !== "Clicked" || !String(payload.target ?? "").includes("/double-optin/confirm")) {
    return { received: true, status: sanitize(payload.status), message: "Event ignored" };
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [payload.to] });
    return { received: true, confirmed: true, email: sanitize(payload.to) };
  } catch (err) {
    const { status, message } = apiError(err);
    return fail(event, status, message);
  }
});
