// POST /.redwood/functions/sendScheduled
// Body: { to, delayMinutes? }
import type { APIGatewayEvent, Context } from "aws-lambda";
import { apiError, emailsApi, from, json, readJson } from "src/lib/elasticemail";

// TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
// Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
const maxOffset = 50400;

export const handler = async (event: APIGatewayEvent, _context: Context) => {
  if (event.httpMethod !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { to, delayMinutes = 60 } = await readJson(event);

  if (!to) {
    return json({ error: "Missing required field: to" }, 400);
  }

  const offset = Number(delayMinutes);
  if (!Number.isInteger(offset) || offset < 1 || offset > maxOffset) {
    return json({ error: `delayMinutes must be between 1 and ${maxOffset}` }, 400);
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
    return json({
      success: true,
      transactionId: data.TransactionID,
      messageId: data.MessageID,
      scheduledFor: scheduledFor.toISOString(),
    });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, status);
  }
};
