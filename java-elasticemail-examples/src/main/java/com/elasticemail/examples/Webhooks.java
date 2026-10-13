package com.elasticemail.examples;

import com.elasticemail.api.WebhookApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.Webhook;
import com.elasticemail.model.WebhookCreatePayload;
import com.elasticemail.model.WebhookDeliveryMethod;

import java.util.List;

public class Webhooks {
    public static void main(String[] args) {
        WebhookApi webhookApi = new WebhookApi(Ee.client());

        String publicUrl = Ee.env("PUBLIC_URL", "http://localhost:3000");

        // Signed webhooks: Elastic Email POSTs each event as JSON and signs it with HMAC-SHA256
        // (X-ElasticEmail-Signature). The handler verifies the signature with the secret returned
        // below, so the URL needs no ?token=. Signing and the delivery method can't be changed later.
        String webhookUrl = publicUrl + "/webhook";

        // 1. Create. Elastic Email sends a test request to the URL on save, so the handler must be
        //    reachable (use a tunnel such as ngrok for local development). The handler doesn't know the
        //    secret yet and answers 401, which Elastic Email accepts for that test.
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
                    .notificationForError(true)
                    .enableSigning(true)
                    .deliveryMethod(WebhookDeliveryMethod.POST_JSON));
            webhookId = created.getWebhookID();
            System.out.println("Webhook created: " + webhookId + " " + created.getURL());
            // The secret is returned only here. Store it as ELASTICEMAIL_WEBHOOK_SECRET.
            System.out.println("Signing secret (shown once, store it as ELASTICEMAIL_WEBHOOK_SECRET): "
                    + created.getSigningSecret());
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

        // 3. Rotate the signing secret. The old one stops working at once (no grace period).
        if (webhookId != null) {
            try {
                Webhook rotated = webhookApi.webhookByPublicidSecretRotatePost(webhookId);
                System.out.println("\nNew signing secret (store it as ELASTICEMAIL_WEBHOOK_SECRET): "
                        + rotated.getSigningSecret());
            } catch (ApiException e) {
                fail("rotate webhook secret", e);
            }
        }

        // 4. Delete the one we created (comment out to keep it)
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
