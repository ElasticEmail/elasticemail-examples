package com.elasticemail.examples;

import com.elasticemail.api.EmailsApi;
import com.elasticemail.api.TemplatesApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.TemplatePayload;
import com.elasticemail.model.TemplateScope;
import com.elasticemail.model.TransactionalRecipient;

import java.util.List;
import java.util.Map;

public class WithTemplate {
    public static void main(String[] args) {
        var client = Ee.client();
        EmailsApi emailsApi = new EmailsApi(client);
        TemplatesApi templatesApi = new TemplatesApi(client);
        String templateName = Ee.env("ELASTICEMAIL_TEMPLATE_NAME", "welcome-example");

        try {
            ensureTemplate(templatesApi, templateName);

            // Merge values replace {placeholders} in the template subject and body.
            EmailTransactionalMessageData data = new EmailTransactionalMessageData()
                    .recipients(new TransactionalRecipient().to(List.of(Ee.to())))
                    .content(new EmailContent()
                            .from(Ee.from())
                            .templateName(templateName)
                            .merge(Map.of("firstname", "Ann", "company", "Acme")));

            EmailSend result = emailsApi.emailsTransactionalPost(data);
            System.out.println("Template email sent successfully!");
            System.out.println("Transaction ID: " + result.getTransactionID());
            System.out.println("Message ID: " + result.getMessageID());
        } catch (ApiException e) {
            Ee.printApiError("template send", e);
            System.exit(1);
        }
    }

    // Templates are referenced by name. Create it on first run.
    private static void ensureTemplate(TemplatesApi templatesApi, String templateName) throws ApiException {
        try {
            templatesApi.templatesByNameGet(templateName);
            System.out.println("Template \"" + templateName + "\" already exists.");
        } catch (ApiException e) {
            if (e.getCode() != 404) {
                throw e;
            }
            templatesApi.templatesPost(new TemplatePayload()
                    .name(templateName)
                    .subject("Welcome, {firstname}!")
                    .body(List.of(new BodyPart()
                            .contentType(BodyContentType.HTML)
                            .content("<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>")))
                    .templateScope(TemplateScope.PERSONAL));
            System.out.println("Template \"" + templateName + "\" created.");
        }
    }
}
