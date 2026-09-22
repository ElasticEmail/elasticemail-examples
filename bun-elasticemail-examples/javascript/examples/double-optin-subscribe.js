import { createHmac } from "node:crypto";
import { Configuration, ContactsApi, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const contactsApi = new ContactsApi(config);
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
const secret = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";

// Usage: bun run examples/double-optin-subscribe.js user@example.com "John Doe"
const [email, name = ""] = process.argv.slice(2);

if (!email) {
  console.error('Usage: bun run examples/double-optin-subscribe.js <email> ["Name"]');
  process.exit(1);
}

// The confirm link carries an HMAC of the email so the confirm endpoint can trust it.
const confirmToken = createHmac("sha256", secret).update(email).digest("hex");
const confirmUrl = `${publicUrl}/double-optin/confirm?email=${encodeURIComponent(email)}&token=${confirmToken}`;

try {
  // Step 1: store the contact without adding it to the marketing list.
  // Status "Transactional" allows sending the confirmation but excludes it from campaigns.
  await contactsApi.contactsPost([
    {
      Email: email,
      FirstName: name.split(" ")[0] || "",
      LastName: name.split(" ").slice(1).join(" "),
      Status: "Transactional",
    },
  ]);
  console.log("Contact stored (unconfirmed):", email);

  // Step 2: send the confirmation email
  const greeting = name ? `Welcome, ${name}!` : "Welcome!";
  const { data } = await emailsApi.emailsTransactionalPost({
    Recipients: { To: [email] },
    Content: {
      From: from,
      Subject: "Confirm your subscription",
      Body: [
        {
          ContentType: "HTML",
          Content: `<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>${greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="${confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>`,
        },
        {
          ContentType: "PlainText",
          Content: `${greeting}\n\nConfirm your subscription: ${confirmUrl}`,
        },
      ],
    },
  });

  console.log("Confirmation email sent. Message ID:", data.MessageID);
  console.log("Confirm URL:", confirmUrl);
  console.log("\nWhen the link is opened, GET /double-optin/confirm in src/index.js adds the contact to the list.");
} catch (err) {
  console.error("Error:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
