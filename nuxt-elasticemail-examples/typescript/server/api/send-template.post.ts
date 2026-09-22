// POST /api/send-template
// Body: { to, firstName?, company? }
import { defineEventHandler } from "h3";
import { apiError, emailsApi, fail, from, readJson, templateName, templatesApi } from "../utils/elasticemail";

// Templates are referenced by name. Create it on first run.
async function ensureTemplate(): Promise<boolean> {
  try {
    await templatesApi.templatesByNameGet(templateName);
    return false;
  } catch (err) {
    if (apiError(err).status !== 404) throw err;
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
    return true;
  }
}

export default defineEventHandler(async (event) => {
  const { to, firstName = "Ann", company = "Acme" } = await readJson(event);

  if (!to) {
    return fail(event, 400, "Missing required field: to");
  }

  try {
    const created = await ensureTemplate();

    // Merge values replace {placeholders} in the template subject and body.
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        TemplateName: templateName,
        Merge: { firstname: firstName, company },
      },
    });
    return {
      success: true,
      transactionId: data.TransactionID,
      messageId: data.MessageID,
      template: templateName,
      templateCreated: created,
    };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return fail(event, status, error);
  }
});
