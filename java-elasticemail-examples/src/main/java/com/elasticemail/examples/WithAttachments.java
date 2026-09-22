package com.elasticemail.examples;

import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.MessageAttachment;
import com.elasticemail.model.TransactionalRecipient;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

public class WithAttachments {
    public static void main(String[] args) {
        EmailsApi emailsApi = new EmailsApi(Ee.client());

        String fileContent = "Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: "
                + Instant.now() + "\n";

        // BinaryContent is sent as base64. The SDK encodes the byte[] for you.
        // Total message size limit applies (see account limits).
        MessageAttachment attachment = new MessageAttachment()
                .binaryContent(fileContent.getBytes(StandardCharsets.UTF_8))
                .name("sample.txt")
                .contentType("text/plain");

        EmailTransactionalMessageData data = new EmailTransactionalMessageData()
                .recipients(new TransactionalRecipient().to(List.of(Ee.to())))
                .content(new EmailContent()
                        .from(Ee.from())
                        .subject("Email with Attachment")
                        .body(List.of(new BodyPart()
                                .contentType(BodyContentType.HTML)
                                .content("<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>")))
                        .attachments(List.of(attachment)));

        try {
            EmailSend result = emailsApi.emailsTransactionalPost(data);
            System.out.println("Email with attachment sent successfully!");
            System.out.println("Transaction ID: " + result.getTransactionID());
            System.out.println("Message ID: " + result.getMessageID());
        } catch (ApiException e) {
            Ee.printApiError("send email", e);
            System.exit(1);
        }
    }
}
