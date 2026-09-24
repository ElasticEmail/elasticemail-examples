import "dotenv/config";
import { Configuration, EmailsApi, TemplatesApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);
const templatesApi = new TemplatesApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";
const templateName = process.env.ELASTICEMAIL_TEMPLATE_NAME || "welcome-example";

// Templates are referenced by name. Create it on first run.
async function ensureTemplate() {
  try {
    await templatesApi.templatesByNameGet(templateName);
    console.log(`Template "${templateName}" already exists.`);
  } catch (err) {
    if (err.response?.status !== 404) throw err;
    await templatesApi.templatesPost({
      Name: templateName,
      Subject: "Welcome, {firstname}!",
      Body: [
        {
          ContentType: "HTML",
          Content: "<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>",
        },
      ],
      TemplateScope: "Personal",
    });
    console.log(`Template "${templateName}" created.`);
  }
}

try {
  await ensureTemplate();

  // Merge values replace {placeholders} in the template subject and body.
  const { data } = await emailsApi.emailsTransactionalPost({
    Recipients: { To: [to] },
    Content: {
      From: from,
      TemplateName: templateName,
      Merge: { firstname: "Ann", company: "Acme" },
    },
  });

  console.log("Template email sent successfully!");
  console.log("Transaction ID:", data.TransactionID);
  console.log("Message ID:", data.MessageID);
} catch (err) {
  console.error("Error:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
