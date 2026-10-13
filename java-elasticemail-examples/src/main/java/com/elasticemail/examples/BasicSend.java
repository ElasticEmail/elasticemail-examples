package com.elasticemail.examples;

import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.TransactionalRecipient;

import java.util.List;
import java.util.UUID;

public class BasicSend {
    public static void main(String[] args) {
        EmailsApi emailsApi = new EmailsApi(Ee.client());

        EmailTransactionalMessageData data = new EmailTransactionalMessageData()
                .recipients(new TransactionalRecipient().to(List.of(Ee.to())))
                .content(new EmailContent()
                        .from(Ee.from())
                        .subject("Hello from Elastic Email!")
                        .body(List.of(
                                new BodyPart()
                                        .contentType(BodyContentType.HTML)
                                        .content("<h1>Welcome!</h1><p>This email was sent using the Elastic Email Java SDK.</p>"),
                                new BodyPart()
                                        .contentType(BodyContentType.PLAIN_TEXT)
                                        .content("Welcome! This email was sent using the Elastic Email Java SDK."))));

        // Reuse this key only to retry this same send.
        String idempotencyKey = UUID.randomUUID().toString();

        try {
            EmailSend result = emailsApi.emailsTransactionalPost(data, idempotencyKey);
            System.out.println("Email sent successfully!");
            System.out.println("Transaction ID: " + result.getTransactionID());
            System.out.println("Message ID: " + result.getMessageID());
            System.out.println("Idempotency key: " + idempotencyKey);
        } catch (ApiException e) {
            Ee.printApiError("send email", e);
            System.exit(1);
        }
    }
}
