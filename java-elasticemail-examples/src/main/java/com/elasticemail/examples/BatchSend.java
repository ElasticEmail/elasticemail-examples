package com.elasticemail.examples;

import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailMessageData;
import com.elasticemail.model.EmailRecipient;
import com.elasticemail.model.EmailSend;

import java.util.List;
import java.util.Map;

public class BatchSend {
    public static void main(String[] args) {
        EmailsApi emailsApi = new EmailsApi(Ee.client());
        String to = Ee.to();

        // Bulk send: one API call, one personalized email per recipient.
        // Values from Recipients[].Fields replace {placeholders} in the body.
        // Up to 1000 recipients per request.
        List<EmailRecipient> recipients = List.of(
                new EmailRecipient().email(to).fields(Map.of("firstname", "Ann", "plan", "Pro")),
                new EmailRecipient().email(to).fields(Map.of("firstname", "Ben", "plan", "Starter")),
                new EmailRecipient().email(to).fields(Map.of("firstname", "Cleo", "plan", "Team")));

        EmailMessageData data = new EmailMessageData()
                .recipients(recipients)
                .content(new EmailContent()
                        .from(Ee.from())
                        .subject("Hi {firstname}, your {plan} plan is ready")
                        .body(List.of(
                                new BodyPart()
                                        .contentType(BodyContentType.HTML)
                                        .content("<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>"),
                                new BodyPart()
                                        .contentType(BodyContentType.PLAIN_TEXT)
                                        .content("Hi {firstname}! Your {plan} plan is now active."))));

        try {
            EmailSend result = emailsApi.emailsPost(data);
            System.out.println("Bulk email queued for " + recipients.size() + " recipients.");
            System.out.println("Transaction ID: " + result.getTransactionID());
            System.out.println("Check delivery with: mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.EmailStatus -Dexec.args=\""
                    + result.getTransactionID() + "\"");
        } catch (ApiException e) {
            Ee.printApiError("send bulk email", e);
            System.exit(1);
        }
    }
}
