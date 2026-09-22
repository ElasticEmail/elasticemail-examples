// POST /api/double-optin/webhook?token=...
//
// Click-tracking based confirmation. Create an Elastic Email webhook for Clicked events
// pointing at this URL. When the clicked link is the confirmation link, the recipient
// is added to the list. GET (the URL validation ping) is answered by webhook.get.ts.
import { defineEventHandler, getQuery } from "h3";
import { apiError, fail, listName, listsApi, readEvent, sanitize, tokenOk } from "../../utils/elasticemail";

export default defineEventHandler(async (event) => {
  if (!tokenOk(getQuery(event).token)) {
    return fail(event, 401, "Invalid token");
  }

  const payload = await readEvent(event);
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
