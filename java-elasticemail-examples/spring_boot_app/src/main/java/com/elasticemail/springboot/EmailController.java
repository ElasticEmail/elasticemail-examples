package com.elasticemail.springboot;

import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiClient;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.BodyContentType;
import com.elasticemail.model.BodyPart;
import com.elasticemail.model.EmailContent;
import com.elasticemail.model.EmailSend;
import com.elasticemail.model.EmailTransactionalMessageData;
import com.elasticemail.model.TransactionalRecipient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class EmailController {

    private final EmailsApi emailsApi;

    @Value("${EMAIL_FROM:Acme <hello@yourdomain.com>}")
    private String from;

    public EmailController(ApiClient apiClient) {
        this.emailsApi = new EmailsApi(apiClient);
    }

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> sendEmail(@RequestBody Map<String, String> body) {
        String to = body.get("to");
        String subject = body.get("subject");
        String message = body.get("message");

        if (to == null || subject == null || message == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Missing required fields: to, subject, message"));
        }

        try {
            EmailSend result = emailsApi.emailsTransactionalPost(new EmailTransactionalMessageData()
                    .recipients(new TransactionalRecipient().to(List.of(to)))
                    .content(new EmailContent()
                            .from(from)
                            .subject(subject)
                            .body(List.of(new BodyPart().contentType(BodyContentType.HTML).content("<p>" + message + "</p>")))));
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "transactionId", result.getTransactionID(),
                    "messageId", result.getMessageID()));
        } catch (ApiException e) {
            return Support.apiError(e);
        }
    }
}
