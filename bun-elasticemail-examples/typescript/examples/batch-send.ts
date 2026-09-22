import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";

// Bulk send: one API call, one personalized email per recipient.
// Values from Recipients[].Fields replace {placeholders} in the body.
// Up to 1000 recipients per request.
const recipients = [
  { Email: to, Fields: { firstname: "Ann", plan: "Pro" } },
  { Email: to, Fields: { firstname: "Ben", plan: "Starter" } },
  { Email: to, Fields: { firstname: "Cleo", plan: "Team" } },
];

try {
  const { data } = await emailsApi.emailsPost({
    Recipients: recipients,
    Content: {
      From: from,
      Subject: "Hi {firstname}, your {plan} plan is ready",
      Body: [
        {
          ContentType: "HTML",
          Content: "<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>",
        },
        {
          ContentType: "PlainText",
          Content: "Hi {firstname}! Your {plan} plan is now active.",
        },
      ],
    },
  });

  console.log(`Bulk email queued for ${recipients.length} recipients.`);
  console.log("Transaction ID:", data.TransactionID);
  console.log("Check delivery with: bun run examples/email-status.ts", data.TransactionID);
} catch (err: any) {
  console.error("Error sending bulk email:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
