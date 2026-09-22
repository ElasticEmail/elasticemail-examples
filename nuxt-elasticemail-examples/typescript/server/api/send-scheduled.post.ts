// POST /api/send-scheduled
// Body: { to, delayMinutes? }
import { defineEventHandler } from "h3";
import { apiError, emailsApi, fail, from, readJson } from "../utils/elasticemail";

// TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
// Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
const maxOffset = 50400;

export default defineEventHandler(async (event) => {
  const { to, delayMinutes = 60 } = await readJson(event);

  if (!to) {
    return fail(event, 400, "Missing required field: to");
  }

  const offset = Number(delayMinutes);
  if (!Number.isInteger(offset) || offset < 1 || offset > maxOffset) {
    return fail(event, 400, `delayMinutes must be between 1 and ${maxOffset}`);
  }

  const scheduledFor = new Date(Date.now() + offset * 60 * 1000);

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: "Scheduled Email",
        Body: [
          {
            ContentType: "HTML",
            Content: `<h1>Scheduled Email</h1><p>This email was scheduled for ${scheduledFor.toISOString()}.</p>`,
          },
        ],
      },
      Options: { TimeOffset: offset },
    });
    return {
      success: true,
      transactionId: data.TransactionID,
      messageId: data.MessageID,
      scheduledFor: scheduledFor.toISOString(),
    };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return fail(event, status, error);
  }
});
