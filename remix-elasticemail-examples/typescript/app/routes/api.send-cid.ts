// POST /api/send-cid
// Body: { to }
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { apiError, emailsApi, from, readJson } from "../lib/elasticemail.server";

// Minimal 1x1 PNG placeholder (base64-encoded)
const placeholderImage =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export async function action({ request }: ActionFunctionArgs) {
  const { to } = await readJson(request);

  if (!to) {
    return json({ error: "Missing required field: to" }, { status: 400 });
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
    return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, { status });
  }
}
