package com.elasticemail.examples

import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailMessageData
import com.elasticemail.model.EmailRecipient

fun main(args: Array<String>) {
    val emailsApi = EmailsApi(Ee.client())
    val to = Ee.to()

    // Bulk send: one API call, one personalized email per recipient.
    // Values from Recipients[].Fields replace {placeholders} in the body.
    // Up to 1000 recipients per request.
    val recipients = listOf(
        EmailRecipient().email(to).fields(mapOf("firstname" to "Ann", "plan" to "Pro")),
        EmailRecipient().email(to).fields(mapOf("firstname" to "Ben", "plan" to "Starter")),
        EmailRecipient().email(to).fields(mapOf("firstname" to "Cleo", "plan" to "Team")),
    )

    val data = EmailMessageData()
        .recipients(recipients)
        .content(
            EmailContent()
                .from(Ee.from())
                .subject("Hi {firstname}, your {plan} plan is ready")
                .body(
                    listOf(
                        BodyPart()
                            .contentType(BodyContentType.HTML)
                            .content("<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>"),
                        BodyPart()
                            .contentType(BodyContentType.PLAIN_TEXT)
                            .content("Hi {firstname}! Your {plan} plan is now active."),
                    ),
                ),
        )

    try {
        val result = emailsApi.emailsPost(data)
        println("Bulk email queued for ${recipients.size} recipients.")
        println("Transaction ID: ${result.transactionID}")
        println(
            "Check delivery with: mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.EmailStatusKt " +
                "-Dexec.args=\"${result.transactionID}\"",
        )
    } catch (e: ApiException) {
        Ee.fail("send bulk email", e)
    }
}
