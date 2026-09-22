// GET /double-optin/confirm?email=...&token=...
//
// Validates the HMAC token from the confirmation link and adds the contact to the list.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, hmac, listName, listsApi } from "@/lib/elasticemail";

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const expected = Buffer.from(hmac(email));
  const given = Buffer.from(token);
  if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return NextResponse.json({ error: "Invalid confirmation link" }, { status: 400 });
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [email] });
    const redirectUrl = process.env.CONFIRM_REDIRECT_URL;
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.json({ confirmed: true, email, list: listName });
  } catch (err) {
    const { status, message } = apiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
