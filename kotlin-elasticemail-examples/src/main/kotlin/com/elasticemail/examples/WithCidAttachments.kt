package com.elasticemail.examples

import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailTransactionalMessageData
import com.elasticemail.model.MessageAttachment
import com.elasticemail.model.TransactionalRecipient
import java.util.Base64

// Minimal 1x1 PNG placeholder (base64-encoded)
private const val PLACEHOLDER_IMAGE =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

fun main(args: Array<String>) {
    val emailsApi = EmailsApi(Ee.client())

    // Elastic Email derives the Content-ID of an attachment from its file name.
    // Reference the attachment Name after "cid:" to embed it inline.
    val html = """
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
          <h1>Welcome!</h1>
          <p>This email contains an inline image referenced by Content-ID.</p>
        </div>
    """.trimIndent()

    val data = EmailTransactionalMessageData()
        .recipients(TransactionalRecipient().to(listOf(Ee.to())))
        .content(
            EmailContent()
                .from(Ee.from())
                .subject("Email with Inline Image")
                .body(
                    listOf(
                        BodyPart().contentType(BodyContentType.HTML).content(html),
                        BodyPart()
                            .contentType(BodyContentType.PLAIN_TEXT)
                            .content("Welcome! This email contains an inline image referenced by Content-ID."),
                    ),
                )
                .attachments(
                    listOf(
                        MessageAttachment()
                            .binaryContent(Base64.getDecoder().decode(PLACEHOLDER_IMAGE))
                            .name("logo.png")
                            .contentType("image/png"),
                    ),
                ),
        )

    try {
        val result = emailsApi.emailsTransactionalPost(data)
        println("Email with inline image sent successfully!")
        println("Transaction ID: ${result.transactionID}")
        println("Message ID: ${result.messageID}")
    } catch (e: ApiException) {
        Ee.fail("send email", e)
    }
}
