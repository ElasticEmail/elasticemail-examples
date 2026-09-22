// POST /api/send-attachment
// Body: { to }
import type { APIRoute } from "astro";
import { apiError, emailsApi, from, json, readJson } from "../../lib/elasticemail";

export const POST: APIRoute = async ({ request }) => {
  const { to } = await readJson(request);

  if (!to) {
    return json({ error: "Missing required field: to" }, 400);
  }

  const fileContent = `Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: ${new Date().toISOString()}\n`;
  const encoded = Buffer.from(fileContent).toString("base64");

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: "Email with Attachment",
        Body: [
          {
            ContentType: "HTML",
            Content: "<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>",
          },
        ],
        // BinaryContent is base64. Total message size limit applies (see account limits).
        Attachments: [
          {
            BinaryContent: encoded,
            Name: "sample.txt",
            ContentType: "text/plain",
          },
        ],
      },
    });
    return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, status);
  }
};
