// GET /api/double-optin/confirm?email=...&token=...
//
// Validates the HMAC token from the confirmation link and adds the contact to the list.
import { timingSafeEqual } from "node:crypto";
import { defineEventHandler, getQuery, sendRedirect } from "h3";
import { apiError, fail, hmac, listName, listsApi } from "../../utils/elasticemail";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const email = String(query.email ?? "");
  const token = String(query.token ?? "");

  const expected = Buffer.from(hmac(email));
  const given = Buffer.from(token);
  if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return fail(event, 400, "Invalid confirmation link");
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [email] });
    const redirectUrl = process.env.CONFIRM_REDIRECT_URL;
    if (redirectUrl) {
      return sendRedirect(event, redirectUrl);
    }
    return { confirmed: true, email, list: listName };
  } catch (err) {
    const { status, message } = apiError(err);
    return fail(event, status, message);
  }
});
