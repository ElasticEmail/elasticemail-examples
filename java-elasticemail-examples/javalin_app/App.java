package com.elasticemail.javalin;

import com.elasticemail.api.ContactsApi;
import com.elasticemail.api.EmailsApi;
import com.elasticemail.api.ListsApi;
import com.elasticemail.client.ApiClient;
import com.elasticemail.client.ApiException;
import com.elasticemail.client.Configuration;
import com.elasticemail.client.auth.ApiKeyAuth;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.ContactPayload;
import com.elasticemail.model.ContactStatus;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.EmailsPayload;
import com.elasticemail.model.MessageAttachment;
import com.elasticemail.model.TransactionalRecipient;
import io.github.cdimascio.dotenv.Dotenv;
import io.javalin.Javalin;
import io.javalin.http.Context;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

public class App {
    private static EmailsApi emailsApi;
    private static ContactsApi contactsApi;
    private static ListsApi listsApi;

    private static String from;
    private static String contactEmail;
    private static String listName;
    private static String publicUrl;
    private static String secret;
    private static String confirmRedirectUrl;

    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();

        String apiKey = dotenv.get("ELASTICEMAIL_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) {
            System.err.println("ELASTICEMAIL_API_KEY environment variable is required");
            System.exit(1);
        }

        ApiClient client = Configuration.getDefaultApiClient();
        ApiKeyAuth apikey = (ApiKeyAuth) client.getAuthentication("apikey");
        apikey.setApiKey(apiKey);
        emailsApi = new EmailsApi(client);
        contactsApi = new ContactsApi(client);
        listsApi = new ListsApi(client);

        from = dotenv.get("EMAIL_FROM", "Acme <hello@yourdomain.com>");
        contactEmail = dotenv.get("CONTACT_EMAIL", from);
        listName = dotenv.get("ELASTICEMAIL_LIST_NAME", "Newsletter");
        publicUrl = dotenv.get("PUBLIC_URL", "http://localhost:3000");
        secret = dotenv.get("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");
        confirmRedirectUrl = dotenv.get("CONFIRM_REDIRECT_URL");

        int port = Integer.parseInt(dotenv.get("PORT", "3000"));

        // Inbound notifications carry base64 attachments in the form body
        Javalin app = Javalin.create(config -> config.http.maxRequestSize = 25L * 1024 * 1024).start(port);

        app.get("/health", ctx -> ctx.json(Map.of("status", "ok")));
        app.post("/send", App::sendHandler);
        app.get("/webhook", App::webhookHandler);
        app.post("/webhook", App::webhookHandler);
        app.post("/inbound", App::inboundHandler);
        app.post("/double-optin/subscribe", App::doubleOptinSubscribeHandler);
        app.get("/double-optin/confirm", App::doubleOptinConfirmHandler);
        app.post("/double-optin/webhook", App::doubleOptinWebhookHandler);

        System.out.println("Javalin server running on http://localhost:" + port);
    }

    private static void sendHandler(Context ctx) {
        Map<String, String> body = jsonBody(ctx);
        String to = body.get("to");
        String subject = body.get("subject");
        String message = body.get("message");

        if (to == null || subject == null || message == null) {
            ctx.status(400).json(Map.of("error", "Missing required fields: to, subject, message"));
            return;
        }

        try {
            EmailSend result = emailsApi.emailsTransactionalPost(new EmailTransactionalMessageData()
                    .recipients(new TransactionalRecipient().to(List.of(to)))
                    .content(new EmailContent()
                            .from(from)
                            .subject(subject)
                            .body(List.of(new BodyPart().contentType(BodyContentType.HTML).content("<p>" + message + "</p>")))));
            ctx.json(Map.of("success", true, "transactionId", result.getTransactionID(), "messageId", result.getMessageID()));
        } catch (ApiException e) {
            apiError(ctx, e);
        }
    }

    // Elastic Email event notifications. Parameters arrive in the query string (GET) or as
    // form fields (POST): transaction, messageid, to, from, subject, date, status, category,
    // channel, target (clicked URL), IP, Useragent, Country, City.
    // Elastic Email sends a GET to validate the URL when the webhook is saved.
    private static void webhookHandler(Context ctx) {
        if (!tokenOk(ctx.queryParam("token"))) {
            ctx.status(401).json(Map.of("error", "Invalid token"));
            return;
        }

        Map<String, String> event = params(ctx);
        String status = sanitize(event.get("status"));

        if (status.isEmpty()) {
            // Validation ping or empty request
            ctx.json(Map.of("ok", true));
            return;
        }

        System.out.println("Webhook event: " + status + " to: " + sanitize(event.get("to"))
                + " transaction: " + sanitize(event.get("transaction")));

        switch (status) {
            case "Sent" -> System.out.println("Email sent, message id: " + sanitize(event.get("messageid")));
            case "Opened" -> System.out.println("Email opened from " + sanitize(event.get("Country")) + " " + sanitize(event.get("City")));
            case "Clicked" -> System.out.println("Link clicked: " + sanitize(event.get("target")));
            case "Error" -> System.out.println("Bounce/error, category: " + sanitize(event.get("category")));
            case "AbuseReport" -> System.out.println("Complaint received");
            case "Unsubscribed" -> System.out.println("Recipient unsubscribed");
            default -> { }
        }

        ctx.json(Map.of("received", true, "status", status));
    }

    // Inbound email pushed by an inbound route with ActionType NotifyViaHttp.
    // Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
    // subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
    private static void inboundHandler(Context ctx) {
        if (!tokenOk(ctx.queryParam("token"))) {
            ctx.status(401).json(Map.of("error", "Invalid token"));
            return;
        }

        Map<String, String> mail = params(ctx);
        List<MessageAttachment> attachments = new ArrayList<>();
        List<String> attachmentNames = new ArrayList<>();
        for (String key : mail.keySet()) {
            if (key.matches("^att\\d+_name$")) {
                String name = mail.get(key);
                String content = mail.get(key.replace("_name", "_content"));
                attachmentNames.add(name);
                if (content != null && !content.isEmpty()) {
                    attachments.add(new MessageAttachment().name(name).binaryContent(Base64.getDecoder().decode(content)));
                }
            }
        }

        System.out.println("Inbound email from: " + sanitize(mail.get("from_email")) + " subject: " + sanitize(mail.get("subject")));
        System.out.println("Attachments: " + (attachmentNames.isEmpty() ? "none" : String.join(", ", attachmentNames)));

        String subject = mail.get("subject") == null ? "(no subject)" : mail.get("subject");
        String bodyHtml = mail.get("body_html");
        if (bodyHtml == null || bodyHtml.isEmpty()) {
            String text = mail.get("body_text") == null ? "" : mail.get("body_text");
            bodyHtml = "<pre>" + text.replace("<", "&lt;") + "</pre>";
        }

        // Forward a copy to the team inbox
        try {
            EmailContent content = new EmailContent()
                    .from(from)
                    .replyTo(mail.get("from_email"))
                    .subject("Fwd: " + subject)
                    .body(List.of(new BodyPart().contentType(BodyContentType.HTML).content(bodyHtml)));
            if (!attachments.isEmpty()) {
                content.attachments(attachments);
            }
            EmailSend result = emailsApi.emailsTransactionalPost(new EmailTransactionalMessageData()
                    .recipients(new TransactionalRecipient().to(List.of(contactEmail)))
                    .content(content));
            ctx.json(Map.of("received", true, "forwardedMessageId", result.getMessageID()));
        } catch (ApiException e) {
            apiError(ctx, e);
        }
    }

    private static void doubleOptinSubscribeHandler(Context ctx) {
        Map<String, String> body = jsonBody(ctx);
        String email = body.get("email");
        String name = body.getOrDefault("name", "");
        if (name == null) {
            name = "";
        }

        if (email == null || email.isEmpty()) {
            ctx.status(400).json(Map.of("error", "Missing required field: email"));
            return;
        }

        String confirmUrl = publicUrl + "/double-optin/confirm?email="
                + URLEncoder.encode(email, StandardCharsets.UTF_8) + "&token=" + hmac(email);
        String greeting = name.isEmpty() ? "Welcome!" : "Welcome, " + name + "!";

        try {
            // Stored as Transactional so it receives the confirmation but no campaigns yet
            contactsApi.contactsPost(List.of(new ContactPayload()
                    .email(email)
                    .firstName(name.trim().split("\\s+", 2)[0])
                    .status(ContactStatus.TRANSACTIONAL)), null);

            String html = "<div style=\"text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;\">"
                    + "<h1>" + greeting + "</h1>"
                    + "<p>Please confirm your subscription to our newsletter.</p>"
                    + "<a href=\"" + confirmUrl + "\" style=\"background-color: #18181b; color: #fff; padding: 12px 32px; "
                    + "border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;\">Confirm Subscription</a>"
                    + "</div>";

            EmailSend result = emailsApi.emailsTransactionalPost(new EmailTransactionalMessageData()
                    .recipients(new TransactionalRecipient().to(List.of(email)))
                    .content(new EmailContent()
                            .from(from)
                            .subject("Confirm your subscription")
                            .body(List.of(new BodyPart().contentType(BodyContentType.HTML).content(html)))));

            ctx.json(Map.of("success", true, "message", "Confirmation email sent", "messageId", result.getMessageID()));
        } catch (ApiException e) {
            apiError(ctx, e);
        }
    }

    private static void doubleOptinConfirmHandler(Context ctx) {
        String email = ctx.queryParam("email") == null ? "" : ctx.queryParam("email");
        String token = ctx.queryParam("token") == null ? "" : ctx.queryParam("token");

        byte[] expected = hmac(email).getBytes(StandardCharsets.UTF_8);
        byte[] given = token.getBytes(StandardCharsets.UTF_8);
        if (email.isEmpty() || !MessageDigest.isEqual(expected, given)) {
            ctx.status(400).json(Map.of("error", "Invalid confirmation link"));
            return;
        }

        try {
            listsApi.listsByNameContactsPost(listName, new EmailsPayload().emails(List.of(email)));
            if (confirmRedirectUrl != null && !confirmRedirectUrl.isEmpty()) {
                ctx.redirect(confirmRedirectUrl);
                return;
            }
            ctx.json(Map.of("confirmed", true, "email", email, "list", listName));
        } catch (ApiException e) {
            apiError(ctx, e);
        }
    }

    // Click-tracking based confirmation: create a webhook for Clicked events pointing here.
    private static void doubleOptinWebhookHandler(Context ctx) {
        if (!tokenOk(ctx.queryParam("token"))) {
            ctx.status(401).json(Map.of("error", "Invalid token"));
            return;
        }

        Map<String, String> event = params(ctx);
        String status = sanitize(event.get("status"));
        String target = event.get("target") == null ? "" : event.get("target");
        String to = sanitize(event.get("to"));

        if (!"Clicked".equals(status) || !target.contains("/double-optin/confirm")) {
            ctx.json(Map.of("received", true, "status", status, "message", "Event ignored"));
            return;
        }

        try {
            listsApi.listsByNameContactsPost(listName, new EmailsPayload().emails(List.of(to)));
            ctx.json(Map.of("received", true, "confirmed", true, "email", to));
        } catch (ApiException e) {
            apiError(ctx, e);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> jsonBody(Context ctx) {
        try {
            Map<String, String> body = ctx.bodyAsClass(Map.class);
            return body == null ? Map.of() : body;
        } catch (Exception e) {
            return Map.of();
        }
    }

    /** Query string parameters first, form fields override (Elastic Email posts form-encoded). */
    private static Map<String, String> params(Context ctx) {
        Map<String, String> merged = new HashMap<>();
        ctx.queryParamMap().forEach((k, v) -> merged.put(k, v.isEmpty() ? "" : v.get(0)));
        ctx.formParamMap().forEach((k, v) -> merged.put(k, v.isEmpty() ? "" : v.get(0)));
        return merged;
    }

    /** Strip newlines from user-controlled values before logging */
    private static String sanitize(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n]", "");
    }

    /** Constant-time comparison of the shared secret carried in ?token= */
    private static boolean tokenOk(String token) {
        byte[] a = (token == null ? "" : token).getBytes(StandardCharsets.UTF_8);
        byte[] b = secret.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    private static String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Responds with the API status code and the Error message from the response body. */
    private static void apiError(Context ctx, ApiException e) {
        int status = e.getCode() >= 400 ? e.getCode() : 500;
        String body = e.getResponseBody();
        String message = body == null || body.isEmpty() ? e.getMessage() : body;
        ctx.status(status).json(Map.of("error", message == null ? "Unknown error" : message));
    }
}
