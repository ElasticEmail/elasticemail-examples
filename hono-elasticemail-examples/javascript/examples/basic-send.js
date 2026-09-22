import "dotenv/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";

try {
  const { data } = await emailsApi.emailsTransactionalPost({
    Recipients: { To: [to] },
    Content: {
      From: from,
      Subject: "Hello from Elastic Email!",
      Body: [
        {
          ContentType: "HTML",
          Content: "<h1>Welcome!</h1><p>This email was sent using the Elastic Email Node.js SDK.</p>",
        },
        {
          ContentType: "PlainText",
          Content: "Welcome! This email was sent using the Elastic Email Node.js SDK.",
        },
      ],
    },
  });

  console.log("Email sent successfully!");
  console.log("Transaction ID:", data.TransactionID);
  console.log("Message ID:", data.MessageID);
} catch (err) {
  console.error("Error sending email:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
