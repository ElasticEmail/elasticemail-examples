package com.elasticemail.examples

import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailTransactionalMessageData
import com.elasticemail.model.TransactionalRecipient

fun main(args: Array<String>) {
    val emailsApi = EmailsApi(Ee.client())

    val data = EmailTransactionalMessageData()
        .recipients(TransactionalRecipient().to(listOf(Ee.to())))
        .content(
            EmailContent()
                .from(Ee.from())
                .subject("Hello from Elastic Email!")
                .body(
                    listOf(
                        BodyPart()
                            .contentType(BodyContentType.HTML)
                            .content("<h1>Welcome!</h1><p>This email was sent from Kotlin using the Elastic Email Java SDK.</p>"),
                        BodyPart()
                            .contentType(BodyContentType.PLAIN_TEXT)
                            .content("Welcome! This email was sent from Kotlin using the Elastic Email Java SDK."),
                    ),
                ),
        )

    try {
        val result = emailsApi.emailsTransactionalPost(data)
        println("Email sent successfully!")
        println("Transaction ID: ${result.transactionID}")
        println("Message ID: ${result.messageID}")
    } catch (e: ApiException) {
        Ee.fail("send email", e)
    }
}
