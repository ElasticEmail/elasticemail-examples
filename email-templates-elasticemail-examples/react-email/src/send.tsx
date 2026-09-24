import "dotenv/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";
import { render } from "react-email";
import Welcome from "../emails/Welcome.js";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";
const dryRun = process.argv.includes("--dry-run");

// Props are type-checked against WelcomeProps. React escapes them, so user input is safe here.
const email = <Welcome name="Ann" actionUrl="https://example.com/start" />;

// Render the same component twice: once to HTML, once to a plain-text alternative.
const html = await render(email);
const text = await render(email, { plainText: true });

if (dryRun) {
  console.log(`Rendered HTML: ${html.length} characters`);
  console.log("Plain text:\n" + text.split("\n").slice(0, 8).join("\n"));
  process.exit(0);
}

try {
  const { data } = await emailsApi.emailsTransactionalPost({
    Recipients: { To: [to] },
    Content: {
      From: from,
      Subject: "Welcome to Acme, Ann!",
      Body: [
        { ContentType: "HTML", Content: html },
        { ContentType: "PlainText", Content: text },
      ],
    },
  });

  console.log("Email sent successfully!");
  console.log("Transaction ID:", data.TransactionID);
  console.log("Message ID:", data.MessageID);
} catch (err: any) {
  console.error("Error sending email:", err.response?.status, err.response?.data?.Error ?? err.message);
  process.exit(1);
}
