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
import java.util.Map;
import java.util.UUID;

public class PreventThreading {
    public static void main(String[] args) {
        EmailsApi emailsApi = new EmailsApi(Ee.client());

        // Gmail groups emails into threads based on subject and Message-ID/References headers.
        // A unique X-Entity-Ref-ID header per email prevents this grouping.
        for (int i = 1; i <= 3; i++) {
            EmailTransactionalMessageData data = new EmailTransactionalMessageData()
                    .recipients(new TransactionalRecipient().to(List.of(Ee.to())))
                    .content(new EmailContent()
                            .from(Ee.from())
                            .subject("Order Confirmation") // Same subject for all
                            .body(List.of(new BodyPart()
                                    .contentType(BodyContentType.HTML)
                                    .content("<h1>Order Confirmation</h1><p>This is email #" + i
                                            + ". Each appears as a separate conversation in Gmail.</p>")))
                            .headers(Map.of("X-Entity-Ref-ID", UUID.randomUUID().toString())));

            try {
                EmailSend result = emailsApi.emailsTransactionalPost(data);
                System.out.println("Email #" + i + " sent: " + result.getMessageID());
            } catch (ApiException e) {
                Ee.printApiError("send email #" + i, e);
                System.exit(1);
            }
        }

        System.out.println("\nAll emails sent with unique X-Entity-Ref-ID headers.");
    }
}
