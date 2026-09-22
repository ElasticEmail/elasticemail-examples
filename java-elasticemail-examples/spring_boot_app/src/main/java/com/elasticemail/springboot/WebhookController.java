package com.elasticemail.springboot;

import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiClient;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.MessageAttachment;
import com.elasticemail.model.TransactionalRecipient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
public class WebhookController {

    private final EmailsApi emailsApi;

    @Value("${ELASTICEMAIL_WEBHOOK_TOKEN:change_me}")
    private String secret;

    @Value("${EMAIL_FROM:Acme <hello@yourdomain.com>}")
    private String from;

    @Value("${CONTACT_EMAIL:}")
    private String contactEmail;

    public WebhookController(ApiClient apiClient) {
        this.emailsApi = new EmailsApi(apiClient);
    }

    // Elastic Email event notifications. Parameters arrive in the query string (GET) or as
    // form fields (POST): transaction, messageid, to, from, subject, date, status, category,
    // channel, target (clicked URL), IP, Useragent, Country, City.
    // Elastic Email sends a GET to validate the URL when the webhook is saved.
    // @RequestParam merges query string and form-encoded body parameters.
    @RequestMapping(value = "/webhook", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<Map<String, Object>> handleWebhook(@RequestParam Map<String, String> event) {
        if (!Support.tokenOk(event.get("token"), secret)) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        }

        String status = Support.sanitize(event.get("status"));
        if (status.isEmpty()) {
            // Validation ping or empty request
            return ResponseEntity.ok(Map.of("ok", true));
        }

        System.out.println("Webhook event: " + status + " to: " + Support.sanitize(event.get("to"))
                + " transaction: " + Support.sanitize(event.get("transaction")));

        switch (status) {
            case "Sent" -> System.out.println("Email sent, message id: " + Support.sanitize(event.get("messageid")));
            case "Opened" -> System.out.println("Email opened from " + Support.sanitize(event.get("Country"))
                    + " " + Support.sanitize(event.get("City")));
            case "Clicked" -> System.out.println("Link clicked: " + Support.sanitize(event.get("target")));
            case "Error" -> System.out.println("Bounce/error, category: " + Support.sanitize(event.get("category")));
            case "AbuseReport" -> System.out.println("Complaint received");
            case "Unsubscribed" -> System.out.println("Recipient unsubscribed");
            default -> { }
        }

        return ResponseEntity.ok(Map.of("received", true, "status", status));
    }

    // Inbound email pushed by an inbound route with ActionType NotifyViaHttp.
    // Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
    // subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
    @PostMapping("/inbound")
    public ResponseEntity<Map<String, Object>> handleInbound(@RequestParam Map<String, String> mail) {
        if (!Support.tokenOk(mail.get("token"), secret)) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        }

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

        System.out.println("Inbound email from: " + Support.sanitize(mail.get("from_email"))
                + " subject: " + Support.sanitize(mail.get("subject")));
        System.out.println("Attachments: " + (attachmentNames.isEmpty() ? "none" : String.join(", ", attachmentNames)));

        String subject = mail.get("subject") == null ? "(no subject)" : mail.get("subject");
        String bodyHtml = mail.get("body_html");
        if (bodyHtml == null || bodyHtml.isEmpty()) {
            String text = mail.get("body_text") == null ? "" : mail.get("body_text");
            bodyHtml = "<pre>" + text.replace("<", "&lt;") + "</pre>";
        }
        String forwardTo = contactEmail == null || contactEmail.isEmpty() ? from : contactEmail;

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
                    .recipients(new TransactionalRecipient().to(List.of(forwardTo)))
                    .content(content));
            return ResponseEntity.ok(Map.of("received", true, "forwardedMessageId", result.getMessageID()));
        } catch (ApiException e) {
            return Support.apiError(e);
        }
    }
}
