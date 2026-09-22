// GET /api/double-optin/confirm?email=...&token=...
//
// Validates the HMAC token from the confirmation link and adds the contact to the list.
import { timingSafeEqual } from "node:crypto";
import { json, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";
import { apiError, hmac, listName, listsApi } from "$lib/server/elasticemail";

export const GET: RequestHandler = async ({ url }) => {
  const email = url.searchParams.get("email") ?? "";
  const token = url.searchParams.get("token") ?? "";

  const expected = Buffer.from(hmac(email));
  const given = Buffer.from(token);
  if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return json({ error: "Invalid confirmation link" }, { status: 400 });
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [email] });
  } catch (err) {
    const { status, message } = apiError(err);
    return json({ error: message }, { status });
  }

  // redirect() throws, so it stays outside the try block
  if (env.CONFIRM_REDIRECT_URL) {
    redirect(302, env.CONFIRM_REDIRECT_URL);
  }
  return json({ confirmed: true, email, list: listName });
};
