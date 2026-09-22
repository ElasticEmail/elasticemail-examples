// POST /api/double-optin/subscribe
// Body: { email, name? }
//
// Creates the contact with Status "Transactional" (receives the confirmation but no campaigns)
// and sends a confirmation link signed with HMAC-SHA256 using ELASTICEMAIL_WEBHOOK_TOKEN.
import { defineEventHandler } from "h3";
import { apiError, contactsApi, emailsApi, fail, from, hmac, publicUrl, readJson } from "../../utils/elasticemail";

export default defineEventHandler(async (event) => {
  const { email, name = "" } = await readJson(event);

  if (!email) {
    return fail(event, 400, "Missing required field: email");
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

    return { success: true, message: "Confirmation email sent", messageId: data.MessageID };
  } catch (err) {
    const { status, message } = apiError(err);
    return fail(event, status, message);
  }
});
