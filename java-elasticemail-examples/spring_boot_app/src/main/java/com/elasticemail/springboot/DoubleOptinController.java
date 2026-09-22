package com.elasticemail.springboot;

import com.elasticemail.api.ContactsApi;
import com.elasticemail.api.EmailsApi;
import com.elasticemail.api.ListsApi;
import com.elasticemail.client.ApiClient;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.ContactPayload;
import com.elasticemail.model.ContactStatus;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.EmailsPayload;
import com.elasticemail.model.TransactionalRecipient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/double-optin")
public class DoubleOptinController {

    private final EmailsApi emailsApi;
    private final ContactsApi contactsApi;
    private final ListsApi listsApi;

    @Value("${EMAIL_FROM:Acme <hello@yourdomain.com>}")
    private String from;

    @Value("${ELASTICEMAIL_LIST_NAME:Newsletter}")
    private String listName;

    @Value("${PUBLIC_URL:http://localhost:3000}")
    private String publicUrl;

    @Value("${ELASTICEMAIL_WEBHOOK_TOKEN:change_me}")
    private String secret;

    @Value("${CONFIRM_REDIRECT_URL:}")
    private String confirmRedirectUrl;

    public DoubleOptinController(ApiClient apiClient) {
        this.emailsApi = new EmailsApi(apiClient);
        this.contactsApi = new ContactsApi(apiClient);
        this.listsApi = new ListsApi(apiClient);
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Map<String, Object>> subscribe(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String name = body.get("name") == null ? "" : body.get("name");

        if (email == null || email.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required field: email"));
        }

        String confirmUrl = publicUrl + "/double-optin/confirm?email="
                + URLEncoder.encode(email, StandardCharsets.UTF_8) + "&token=" + Support.hmacSha256Hex(secret, email);
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

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Confirmation email sent",
                    "messageId", result.getMessageID()));
        } catch (ApiException e) {
            return Support.apiError(e);
        }
    }

    @GetMapping("/confirm")
    public ResponseEntity<Map<String, Object>> confirm(
            @RequestParam(defaultValue = "") String email,
            @RequestParam(defaultValue = "") String token) {

        byte[] expected = Support.hmacSha256Hex(secret, email).getBytes(StandardCharsets.UTF_8);
        byte[] given = token.getBytes(StandardCharsets.UTF_8);
        if (email.isEmpty() || !MessageDigest.isEqual(expected, given)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid confirmation link"));
        }

        try {
            listsApi.listsByNameContactsPost(listName, new EmailsPayload().emails(List.of(email)));
            if (confirmRedirectUrl != null && !confirmRedirectUrl.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FOUND)
                        .header(HttpHeaders.LOCATION, confirmRedirectUrl)
                        .build();
            }
            return ResponseEntity.ok(Map.of("confirmed", true, "email", email, "list", listName));
        } catch (ApiException e) {
            return Support.apiError(e);
        }
    }

    // Click-tracking based confirmation: create a webhook for Clicked events pointing here.
    @PostMapping("/webhook")
    public ResponseEntity<Map<String, Object>> webhook(@RequestParam Map<String, String> event) {
        if (!Support.tokenOk(event.get("token"), secret)) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        }

        String status = Support.sanitize(event.get("status"));
        String target = event.get("target") == null ? "" : event.get("target");
        String to = Support.sanitize(event.get("to"));

        if (!"Clicked".equals(status) || !target.contains("/double-optin/confirm")) {
            return ResponseEntity.ok(Map.of("received", true, "status", status, "message", "Event ignored"));
        }

        try {
            listsApi.listsByNameContactsPost(listName, new EmailsPayload().emails(List.of(to)));
            return ResponseEntity.ok(Map.of("received", true, "confirmed", true, "email", to));
        } catch (ApiException e) {
            return Support.apiError(e);
        }
    }
}
