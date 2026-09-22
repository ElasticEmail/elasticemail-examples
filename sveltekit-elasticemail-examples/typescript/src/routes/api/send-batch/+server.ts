// POST /api/send-batch
// Body: { to }
// Bulk send: one API call, one personalized email per recipient.
// Values from Recipients[].Fields replace {placeholders} in the subject and body.
// Up to 1000 recipients per request.
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { apiError, emailsApi, from, readJson } from "$lib/server/elasticemail";

export const POST: RequestHandler = async ({ request }) => {
  const { to } = await readJson(request);

  if (!to) {
    return json({ error: "Missing required field: to" }, { status: 400 });
  }

  const recipients = [
    { Email: to, Fields: { firstname: "Ann", plan: "Pro" } },
    { Email: to, Fields: { firstname: "Ben", plan: "Starter" } },
    { Email: to, Fields: { firstname: "Cleo", plan: "Team" } },
  ];

  try {
    const { data } = await emailsApi.emailsPost({
      Recipients: recipients,
      Content: {
        From: from,
        Subject: "Hi {firstname}, your {plan} plan is ready",
        Body: [
          {
            ContentType: "HTML",
            Content: "<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>",
          },
          {
            ContentType: "PlainText",
            Content: "Hi {firstname}! Your {plan} plan is now active.",
          },
        ],
      },
    });
    return json({
      success: true,
      transactionId: data.TransactionID,
      messageId: data.MessageID,
      recipients: recipients.length,
    });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, { status });
  }
};
