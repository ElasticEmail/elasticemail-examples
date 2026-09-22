import "dotenv/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";

// TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
// Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
const delayMinutes = 60;
const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

try {
  const { data } = await emailsApi.emailsTransactionalPost({
    Recipients: { To: [to] },
    Content: {
      From: from,
      Subject: "Scheduled Email",
      Body: [
        {
          ContentType: "HTML",
          Content: `<h1>Scheduled Email</h1><p>This email was scheduled for ${scheduledFor.toISOString()}.</p>`,
        },
      ],
    },
    Options: { TimeOffset: delayMinutes },
  });

  console.log(`Email scheduled for ${scheduledFor.toISOString()}`);
  console.log("Transaction ID:", data.TransactionID);
  console.log("Message ID:", data.MessageID);
} catch (err: any) {
  console.error("Error scheduling email:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
