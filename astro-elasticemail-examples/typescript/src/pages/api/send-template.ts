// POST /api/send-template
// Body: { to, firstName?, company? }
import type { APIRoute } from "astro";
import { apiError, emailsApi, from, json, readJson, templateName, templatesApi } from "../../lib/elasticemail";

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

export const POST: APIRoute = async ({ request }) => {
  const { to, firstName = "Ann", company = "Acme" } = await readJson(request);

  if (!to) {
    return json({ error: "Missing required field: to" }, 400);
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
    return json({
      success: true,
      transactionId: data.TransactionID,
      messageId: data.MessageID,
      template: templateName,
      templateCreated: created,
    });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, status);
  }
};
