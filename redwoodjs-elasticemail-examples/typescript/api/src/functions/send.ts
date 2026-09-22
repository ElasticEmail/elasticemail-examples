// POST /.redwood/functions/send
// Body: { to, subject, message }
import type { APIGatewayEvent, Context } from "aws-lambda";
import { apiError, emailsApi, from, json, readJson } from "src/lib/elasticemail";

export const handler = async (event: APIGatewayEvent, _context: Context) => {
  if (event.httpMethod !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { to, subject, message } = await readJson(event);

  if (!to || !subject || !message) {
    return json({ error: "Missing required fields: to, subject, message" }, 400);
  }

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [
          { ContentType: "HTML", Content: `<p>${message}</p>` },
          { ContentType: "PlainText", Content: message },
        ],
      },
    });
    return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, status);
  }
};
