package com.elasticemail.examples

import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailTransactionalMessageData
import com.elasticemail.model.MessageAttachment
import com.elasticemail.model.TransactionalRecipient
import java.time.Instant

fun main(args: Array<String>) {
    val emailsApi = EmailsApi(Ee.client())

    val fileContent = "Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: ${Instant.now()}\n"

    // BinaryContent is sent as base64. The SDK encodes the ByteArray for you.
    // Total message size limit applies (see account limits).
    val attachment = MessageAttachment()
        .binaryContent(fileContent.toByteArray(Charsets.UTF_8))
        .name("sample.txt")
        .contentType("text/plain")

    val data = EmailTransactionalMessageData()
        .recipients(TransactionalRecipient().to(listOf(Ee.to())))
        .content(
            EmailContent()
                .from(Ee.from())
                .subject("Email with Attachment")
                .body(
                    listOf(
                        BodyPart()
                            .contentType(BodyContentType.HTML)
                            .content("<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>"),
                        BodyPart()
                            .contentType(BodyContentType.PLAIN_TEXT)
                            .content("Your attachment is ready. Please find the file attached to this email."),
                    ),
                )
                .attachments(listOf(attachment)),
        )

    try {
        val result = emailsApi.emailsTransactionalPost(data)
        println("Email with attachment sent successfully!")
        println("Transaction ID: ${result.transactionID}")
        println("Message ID: ${result.messageID}")
    } catch (e: ApiException) {
        Ee.fail("send email", e)
    }
}
