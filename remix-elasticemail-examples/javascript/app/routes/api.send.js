// POST /api/send
// Body: { to, subject, message }
import { json } from "@remix-run/node";
import { apiError, emailsApi, from, readJson } from "../lib/elasticemail.server";

export async function action({ request }) {
  const { to, subject, message } = await readJson(request);

  if (!to || !subject || !message) {
    return json({ error: "Missing required fields: to, subject, message" }, { status: 400 });
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
    return json({ error }, { status });
  }
}
