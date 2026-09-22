// POST /api/double-optin/subscribe
// Body: { email, name? }
//
// Creates the contact with Status "Transactional" (receives the confirmation but no campaigns)
// and sends a confirmation link signed with HMAC-SHA256 using ELASTICEMAIL_WEBHOOK_TOKEN.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { apiError, contactsApi, emailsApi, from, hmac, publicUrl, readJson } from "../lib/elasticemail.server";

export async function action({ request }: ActionFunctionArgs) {
  const { email, name = "" } = await readJson(request);

  if (!email) {
    return json({ error: "Missing required field: email" }, { status: 400 });
  }

  const confirmUrl = `${publicUrl}/api/double-optin/confirm?email=${encodeURIComponent(email)}&token=${hmac(email)}`;
  const greeting = name ? `Welcome, ${name}!` : "Welcome!";

  try {
    await contactsApi.contactsPost([
      { Email: email, FirstName: String(name).split(" ")[0] || "", Status: "Transactional" },
    ]);

    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [email] },
      Content: {
        From: from,
        Subject: "Confirm your subscription",
        Body: [
          {
            ContentType: "HTML",
            Content: `<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>${greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="${confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>`,
          },
        ],
      },
    });

    return json({ success: true, message: "Confirmation email sent", messageId: data.MessageID });
  } catch (err) {
    const { status, message } = apiError(err);
    return json({ error: message }, { status });
  }
}
