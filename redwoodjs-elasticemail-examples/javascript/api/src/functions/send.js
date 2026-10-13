// POST /.redwood/functions/send
// Body: { to, subject, message }

import { randomUUID } from "node:crypto";
import { apiError, emailsApi, from, json, readJson } from "src/lib/elasticemail";

export const handler = async (event, _context) => {
  if (event.httpMethod !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { to, subject, message } = await readJson(event);

  if (!to || !subject || !message) {
    return json({ error: "Missing required fields: to, subject, message" }, 400);
  }

  // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new key.
  const idempotencyKey = event.headers?.["idempotency-key"] || event.headers?.["Idempotency-Key"] || randomUUID();

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
    }, idempotencyKey);
    return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, status);
  }
};
