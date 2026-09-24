import "dotenv/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";

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

  console.log("Email with attachment sent successfully!");
  console.log("Transaction ID:", data.TransactionID);
  console.log("Message ID:", data.MessageID);
} catch (err: any) {
  console.error("Error sending email:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
