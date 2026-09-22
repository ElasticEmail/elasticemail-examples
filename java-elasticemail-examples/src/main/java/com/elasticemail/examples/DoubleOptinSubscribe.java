package com.elasticemail.examples;

import com.elasticemail.api.ContactsApi;
import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.ContactPayload;
import com.elasticemail.model.ContactStatus;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.TransactionalRecipient;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;

public class DoubleOptinSubscribe {
    public static void main(String[] args) {
        // Usage: mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.DoubleOptinSubscribe -Dexec.args="user@example.com 'John Doe'"
        if (args.length < 1 || args[0].isEmpty()) {
            System.err.println("Usage: DoubleOptinSubscribe <email> [\"Name\"]");
            System.exit(1);
        }
        String email = args[0];
        String name = args.length > 1 ? args[1] : "";

        var client = Ee.client();
        ContactsApi contactsApi = new ContactsApi(client);
        EmailsApi emailsApi = new EmailsApi(client);

        String from = Ee.from();
        String publicUrl = Ee.env("PUBLIC_URL", "http://localhost:3000");
        String secret = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");

        // The confirm link carries an HMAC of the email so the confirm endpoint can trust it.
        String confirmToken = hmacSha256Hex(secret, email);
        String confirmUrl = publicUrl + "/double-optin/confirm?email="
                + URLEncoder.encode(email, StandardCharsets.UTF_8) + "&token=" + confirmToken;

        String[] parts = name.trim().split("\\s+", 2);
        String firstName = parts[0];
        String lastName = parts.length > 1 ? parts[1] : "";

        try {
            // Step 1: store the contact without adding it to the marketing list.
            // Status Transactional allows sending the confirmation but excludes it from campaigns.
            contactsApi.contactsPost(List.of(new ContactPayload()
                    .email(email)
                    .firstName(firstName)
                    .lastName(lastName)
                    .status(ContactStatus.TRANSACTIONAL)), null);
            System.out.println("Contact stored (unconfirmed): " + email);

            // Step 2: send the confirmation email
            String greeting = name.isEmpty() ? "Welcome!" : "Welcome, " + name + "!";
            String html = "<div style=\"text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;\">\n"
                    + "  <h1>" + greeting + "</h1>\n"
                    + "  <p>Please confirm your subscription to our newsletter.</p>\n"
                    + "  <a href=\"" + confirmUrl + "\" style=\"background-color: #18181b; color: #fff; padding: 12px 32px; "
                    + "border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;\">Confirm Subscription</a>\n"
                    + "</div>";

            EmailSend result = emailsApi.emailsTransactionalPost(new EmailTransactionalMessageData()
                    .recipients(new TransactionalRecipient().to(List.of(email)))
                    .content(new EmailContent()
                            .from(from)
                            .subject("Confirm your subscription")
                            .body(List.of(
                                    new BodyPart().contentType(BodyContentType.HTML).content(html),
                                    new BodyPart().contentType(BodyContentType.PLAIN_TEXT)
                                            .content(greeting + "\n\nConfirm your subscription: " + confirmUrl)))));

            System.out.println("Confirmation email sent. Message ID: " + result.getMessageID());
            System.out.println("Confirm URL: " + confirmUrl);
            System.out.println("\nWhen the link is opened, GET /double-optin/confirm in javalin_app/App.java adds the contact to the list.");
        } catch (ApiException e) {
            Ee.printApiError("double opt-in subscribe", e);
            System.exit(1);
        }
    }

    static String hmacSha256Hex(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
