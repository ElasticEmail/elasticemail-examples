// POST /api/send
// Body: { to, subject, message }
import { defineEventHandler } from "h3";
import { apiError, emailsApi, fail, from, readJson } from "../utils/elasticemail";

export default defineEventHandler(async (event) => {
  const { to, subject, message } = await readJson(event);

  if (!to || !subject || !message) {
    return fail(event, 400, "Missing required fields: to, subject, message");
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
    return { success: true, transactionId: data.TransactionID, messageId: data.MessageID };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return fail(event, status, error);
  }
});
