// GET /api/double-optin/confirm?email=...&token=...
//
// Validates the HMAC token from the confirmation link and adds the contact to the list.
import { timingSafeEqual } from "node:crypto";
import { json, redirect } from "@remix-run/node";
import { apiError, hmac, listName, listsApi } from "../lib/elasticemail.server";

export async function loader({ request }) {
  const params = new URL(request.url).searchParams;
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const expected = Buffer.from(hmac(email));
  const given = Buffer.from(token);
  if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return json({ error: "Invalid confirmation link" }, { status: 400 });
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [email] });
    const redirectUrl = process.env.CONFIRM_REDIRECT_URL;
    if (redirectUrl) {
      return redirect(redirectUrl);
    }
    return json({ confirmed: true, email, list: listName });
  } catch (err) {
    const { status, message } = apiError(err);
    return json({ error: message }, { status });
  }
}
