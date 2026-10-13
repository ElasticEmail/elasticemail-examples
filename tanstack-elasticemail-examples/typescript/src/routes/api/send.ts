// POST /api/send
// Body: { to, subject, message }
import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { apiError, emailsApi, from, json, readJson } from "../../lib/elasticemail";

export const Route = createFileRoute("/api/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { to, subject, message } = await readJson(request);

        if (!to || !subject || !message) {
          return json({ error: "Missing required fields: to, subject, message" }, 400);
        }

        // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new key.
        const idempotencyKey = request.headers.get("Idempotency-Key") || randomUUID();

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
      },
    },
  },
});
