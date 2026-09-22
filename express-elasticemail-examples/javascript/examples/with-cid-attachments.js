import "dotenv/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";

// Minimal 1x1 PNG placeholder (base64-encoded)
const placeholderImage =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

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

  console.log("Email with inline image sent successfully!");
  console.log("Transaction ID:", data.TransactionID);
  console.log("Message ID:", data.MessageID);
} catch (err) {
  console.error("Error sending email:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
