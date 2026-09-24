package com.elasticemail.examples

import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailTransactionalMessageData
import com.elasticemail.model.Options
import com.elasticemail.model.TransactionalRecipient
import java.time.Instant
import java.time.temporal.ChronoUnit

fun main(args: Array<String>) {
    val emailsApi = EmailsApi(Ee.client())

    // TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
    // Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
    val delayMinutes = 60
    val scheduledFor = Instant.now().plus(delayMinutes.toLong(), ChronoUnit.MINUTES)

    val data = EmailTransactionalMessageData()
        .recipients(TransactionalRecipient().to(listOf(Ee.to())))
        .content(
            EmailContent()
                .from(Ee.from())
                .subject("Scheduled Email")
                .body(
                    listOf(
                        BodyPart()
                            .contentType(BodyContentType.HTML)
                            .content("<h1>Scheduled Email</h1><p>This email was scheduled for $scheduledFor.</p>"),
                        BodyPart()
                            .contentType(BodyContentType.PLAIN_TEXT)
                            .content("Scheduled Email. This email was scheduled for $scheduledFor."),
                    ),
                ),
        )
        .options(Options().timeOffset(delayMinutes))

    try {
        val result = emailsApi.emailsTransactionalPost(data)
        println("Email scheduled for $scheduledFor")
        println("Transaction ID: ${result.transactionID}")
        println("Message ID: ${result.messageID}")
    } catch (e: ApiException) {
        Ee.fail("schedule email", e)
    }
}
