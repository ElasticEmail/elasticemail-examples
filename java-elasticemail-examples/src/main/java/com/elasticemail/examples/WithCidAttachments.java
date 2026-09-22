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

import java.util.Base64;
import java.util.List;

public class WithCidAttachments {
    // Minimal 1x1 PNG placeholder (base64-encoded)
    private static final String PLACEHOLDER_IMAGE =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    public static void main(String[] args) {
        EmailsApi emailsApi = new EmailsApi(Ee.client());

        // Elastic Email derives the Content-ID of an attachment from its file name.
        // Reference the attachment Name after "cid:" to embed it inline.
        String html = "<div style=\"font-family: Arial, sans-serif; padding: 20px;\">\n"
                + "  <img src=\"cid:logo.png\" alt=\"Company Logo\" width=\"100\" height=\"100\" />\n"
                + "  <h1>Welcome!</h1>\n"
                + "  <p>This email contains an inline image referenced by Content-ID.</p>\n"
                + "</div>";

        EmailTransactionalMessageData data = new EmailTransactionalMessageData()
                .recipients(new TransactionalRecipient().to(List.of(Ee.to())))
                .content(new EmailContent()
                        .from(Ee.from())
                        .subject("Email with Inline Image")
                        .body(List.of(new BodyPart().contentType(BodyContentType.HTML).content(html)))
                        .attachments(List.of(new MessageAttachment()
                                .binaryContent(Base64.getDecoder().decode(PLACEHOLDER_IMAGE))
                                .name("logo.png")
                                .contentType("image/png"))));

        try {
            EmailSend result = emailsApi.emailsTransactionalPost(data);
            System.out.println("Email with inline image sent successfully!");
            System.out.println("Transaction ID: " + result.getTransactionID());
            System.out.println("Message ID: " + result.getMessageID());
        } catch (ApiException e) {
            Ee.printApiError("send email", e);
            System.exit(1);
        }
    }
}
