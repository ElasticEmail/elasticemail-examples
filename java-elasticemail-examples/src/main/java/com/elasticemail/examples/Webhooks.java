package com.elasticemail.examples;

import com.elasticemail.api.WebhookApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.Webhook;
import com.elasticemail.model.WebhookCreatePayload;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class Webhooks {
    public static void main(String[] args) {
        WebhookApi webhookApi = new WebhookApi(Ee.client());

        String publicUrl = Ee.env("PUBLIC_URL", "http://localhost:3000");
        String token = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");

        // Elastic Email does not sign webhook requests. The examples append a shared secret
        // as a query parameter and the receiving handler checks it.
        String webhookUrl = publicUrl + "/webhook?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);

        // 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
        //    and answer 2xx (use a tunnel such as ngrok for local development).
        String webhookId = null;
        try {
            Webhook created = webhookApi.webhookPost(new WebhookCreatePayload()
                    .name("examples-webhook")
                    .URL(webhookUrl)
                    .notifyOncePerEmail(false)
                    .notificationForSent(true)
                    .notificationForOpened(true)
                    .notificationForClicked(true)
                    .notificationForUnsubscribed(true)
                    .notificationForAbuseReport(true)
                    .notificationForError(true));
            webhookId = created.getWebhookID();
            System.out.println("Webhook created: " + webhookId + " " + created.getURL());
        } catch (ApiException e) {
            fail("create webhook", e);
        }

        // 2. List
        try {
            List<Webhook> webhooks = webhookApi.webhookGet(50, 0);
            System.out.println("\nWebhooks (" + webhooks.size() + "):");
            for (Webhook w : webhooks) {
                System.out.println(" - " + w.getWebhookID() + " " + w.getName() + " " + w.getURL()
                        + " enabled=" + w.getIsEnabled());
            }
        } catch (ApiException e) {
            fail("list webhooks", e);
        }

        // 3. Delete the one we created (comment out to keep it)
        if (webhookId != null) {
            try {
                webhookApi.webhookByPublicidDelete(webhookId);
                System.out.println("\nWebhook deleted: " + webhookId);
            } catch (ApiException e) {
                fail("delete webhook", e);
            }
        }
    }

    private static void fail(String step, ApiException e) {
        Ee.printApiError(step, e);
        System.exit(1);
    }
}
