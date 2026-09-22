// GET /.redwood/functions/doubleOptinConfirm
//
// Validates the HMAC token from the confirmation link and adds the contact to the list.
import type { APIGatewayEvent, Context } from "aws-lambda";
import { timingSafeEqual } from "node:crypto";
import { apiError, hmac, json, listName, listsApi, query, redirect } from "src/lib/elasticemail";

export const handler = async (event: APIGatewayEvent, _context: Context) => {
  if (event.httpMethod !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const params = query(event);
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const expected = Buffer.from(hmac(email));
  const given = Buffer.from(token);
  if (!email || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return json({ error: "Invalid confirmation link" }, 400);
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
    return json({ error: message }, status);
  }
};
