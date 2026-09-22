// POST /api/send-batch
// Body: { to }
// Bulk send: one API call, one personalized email per recipient.
// Values from Recipients[].Fields replace {placeholders} in the subject and body.
// Up to 1000 recipients per request.
import { defineEventHandler } from "h3";
import { apiError, emailsApi, fail, from, readJson } from "../utils/elasticemail";

export default defineEventHandler(async (event) => {
  const { to } = await readJson(event);

  if (!to) {
    return fail(event, 400, "Missing required field: to");
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
    return {
      success: true,
      transactionId: data.TransactionID,
      messageId: data.MessageID,
      recipients: recipients.length,
    };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return fail(event, status, error);
  }
});
