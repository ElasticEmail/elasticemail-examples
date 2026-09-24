package com.elasticemail.examples

import com.elasticemail.api.EmailsApi
import com.elasticemail.api.TemplatesApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailTransactionalMessageData
import com.elasticemail.model.TemplatePayload
import com.elasticemail.model.TemplateScope
import com.elasticemail.model.TransactionalRecipient

fun main(args: Array<String>) {
    val client = Ee.client()
    val emailsApi = EmailsApi(client)
    val templatesApi = TemplatesApi(client)
    val templateName = Ee.env("ELASTICEMAIL_TEMPLATE_NAME", "welcome-example")

    try {
        ensureTemplate(templatesApi, templateName)

        // Merge values replace {placeholders} in the template subject and body.
        val data = EmailTransactionalMessageData()
            .recipients(TransactionalRecipient().to(listOf(Ee.to())))
            .content(
                EmailContent()
                    .from(Ee.from())
                    .templateName(templateName)
                    .merge(mapOf("firstname" to "Ann", "company" to "Acme")),
            )

        val result = emailsApi.emailsTransactionalPost(data)
        println("Template email sent successfully!")
        println("Transaction ID: ${result.transactionID}")
        println("Message ID: ${result.messageID}")
    } catch (e: ApiException) {
        Ee.fail("template send", e)
    }
}

// Templates are referenced by name. Create it on first run.
private fun ensureTemplate(templatesApi: TemplatesApi, templateName: String) {
    try {
        templatesApi.templatesByNameGet(templateName)
        println("Template \"$templateName\" already exists.")
    } catch (e: ApiException) {
        if (e.code != 404) throw e
        templatesApi.templatesPost(
            TemplatePayload()
                .name(templateName)
                .subject("Welcome, {firstname}!")
                .body(
                    listOf(
                        BodyPart()
                            .contentType(BodyContentType.HTML)
                            .content("<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>"),
                        BodyPart()
                            .contentType(BodyContentType.PLAIN_TEXT)
                            .content("Welcome, {firstname}! Thanks for joining {company}."),
                    ),
                )
                .templateScope(TemplateScope.PERSONAL),
        )
        println("Template \"$templateName\" created.")
    }
}
