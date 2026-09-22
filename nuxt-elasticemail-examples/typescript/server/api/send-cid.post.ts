// POST /api/send-cid
// Body: { to }
import { defineEventHandler } from "h3";
import { apiError, emailsApi, fail, from, readJson } from "../utils/elasticemail";

// Minimal 1x1 PNG placeholder (base64-encoded)
const placeholderImage =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export default defineEventHandler(async (event) => {
  const { to } = await readJson(event);

  if (!to) {
    return fail(event, 400, "Missing required field: to");
  }

  // Elastic Email derives the Content-ID of an attachment from its file name.
  // Reference the attachment Name after "cid:" to embed it inline.
  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: "Email with Inline Image",
        Body: [
          {
            ContentType: "HTML",
            Content: `<div style="font-family: Arial, sans-serif; padding: 20px;">
  <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
  <h1>Welcome!</h1>
  <p>This email contains an inline image referenced by Content-ID.</p>
</div>`,
          },
        ],
        Attachments: [
          {
            BinaryContent: placeholderImage,
            Name: "logo.png",
            ContentType: "image/png",
          },
        ],
      },
    });
    return { success: true, transactionId: data.TransactionID, messageId: data.MessageID };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return fail(event, status, error);
  }
});
