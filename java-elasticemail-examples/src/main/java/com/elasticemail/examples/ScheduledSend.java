package com.elasticemail.examples;

import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.Options;
import com.elasticemail.model.TransactionalRecipient;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

public class ScheduledSend {
    public static void main(String[] args) {
        EmailsApi emailsApi = new EmailsApi(Ee.client());

        // TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
        // Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
        int delayMinutes = 60;
        Instant scheduledFor = Instant.now().plus(delayMinutes, ChronoUnit.MINUTES);

        EmailTransactionalMessageData data = new EmailTransactionalMessageData()
                .recipients(new TransactionalRecipient().to(List.of(Ee.to())))
                .content(new EmailContent()
                        .from(Ee.from())
                        .subject("Scheduled Email")
                        .body(List.of(new BodyPart()
                                .contentType(BodyContentType.HTML)
                                .content("<h1>Scheduled Email</h1><p>This email was scheduled for " + scheduledFor + ".</p>"))))
                .options(new Options().timeOffset(delayMinutes));

        try {
            EmailSend result = emailsApi.emailsTransactionalPost(data);
            System.out.println("Email scheduled for " + scheduledFor);
            System.out.println("Transaction ID: " + result.getTransactionID());
            System.out.println("Message ID: " + result.getMessageID());
        } catch (ApiException e) {
            Ee.printApiError("schedule email", e);
            System.exit(1);
        }
    }
}
