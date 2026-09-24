package com.elasticemail.examples

import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailTransactionalMessageData
import com.elasticemail.model.TransactionalRecipient
import java.util.UUID

fun main(args: Array<String>) {
    val emailsApi = EmailsApi(Ee.client())

    // Gmail groups emails into threads based on subject and Message-ID/References headers.
    // A unique X-Entity-Ref-ID header per email prevents this grouping.
    for (i in 1..3) {
        val data = EmailTransactionalMessageData()
            .recipients(TransactionalRecipient().to(listOf(Ee.to())))
            .content(
                EmailContent()
                    .from(Ee.from())
                    .subject("Order Confirmation") // Same subject for all
                    .body(
                        listOf(
                            BodyPart()
                                .contentType(BodyContentType.HTML)
                                .content("<h1>Order Confirmation</h1><p>This is email #$i. Each appears as a separate conversation in Gmail.</p>"),
                            BodyPart()
                                .contentType(BodyContentType.PLAIN_TEXT)
                                .content("Order Confirmation. This is email #$i. Each appears as a separate conversation in Gmail."),
                        ),
                    )
                    .headers(mapOf("X-Entity-Ref-ID" to UUID.randomUUID().toString())),
            )

        try {
            val result = emailsApi.emailsTransactionalPost(data)
            println("Email #$i sent: ${result.messageID}")
        } catch (e: ApiException) {
            Ee.fail("send email #$i", e)
        }
    }

    println("\nAll emails sent with unique X-Entity-Ref-ID headers.")
}
