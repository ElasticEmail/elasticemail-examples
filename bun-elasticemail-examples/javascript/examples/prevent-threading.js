import { randomUUID } from "node:crypto";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";

// Gmail groups emails into threads based on subject and Message-ID/References headers.
// A unique X-Entity-Ref-ID header per email prevents this grouping.
for (let i = 1; i <= 3; i++) {
  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: "Order Confirmation", // Same subject for all
        Body: [
          {
            ContentType: "HTML",
            Content: `<h1>Order Confirmation</h1><p>This is email #${i}. Each appears as a separate conversation in Gmail.</p>`,
          },
        ],
        Headers: {
          "X-Entity-Ref-ID": randomUUID(),
        },
      },
    });

    console.log(`Email #${i} sent: ${data.MessageID}`);
  } catch (err) {
    console.error(`Error sending email #${i}:`, err.response?.status, err.response?.data ?? err.message);
    process.exit(1);
  }
}

console.log("\nAll emails sent with unique X-Entity-Ref-ID headers.");
