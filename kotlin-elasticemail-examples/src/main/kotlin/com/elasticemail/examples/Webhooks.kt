package com.elasticemail.examples

import com.elasticemail.api.WebhookApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.WebhookCreatePayload
import com.elasticemail.model.WebhookDeliveryMethod

fun main(args: Array<String>) {
    val webhookApi = WebhookApi(Ee.client())

    val publicUrl = Ee.env("PUBLIC_URL", "http://localhost:3000")

    // Signed webhooks: Elastic Email POSTs each event as JSON and signs it with HMAC-SHA256
    // (X-ElasticEmail-Signature). The handler verifies the signature with the secret returned
    // below, so the URL needs no ?token=. Signing and the delivery method can't be changed later.
    val webhookUrl = "$publicUrl/webhook"

    // 1. Create. Elastic Email sends a test request to the URL on save, so the handler must be
    //    reachable (use a tunnel such as ngrok for local development). The handler doesn't know the
    //    secret yet and answers 401, which Elastic Email accepts for that test.
    val webhookId = try {
        val created = webhookApi.webhookPost(
            WebhookCreatePayload()
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
                .deliveryMethod(WebhookDeliveryMethod.POST_JSON),
        )
        println("Webhook created: ${created.webhookID} ${created.url}")
        // The secret is returned only here. Store it as ELASTICEMAIL_WEBHOOK_SECRET.
        println("Signing secret (shown once, store it as ELASTICEMAIL_WEBHOOK_SECRET): ${created.signingSecret}")
        created.webhookID
    } catch (e: ApiException) {
        Ee.fail("create webhook", e)
    }

    // 2. List
    try {
        val webhooks = webhookApi.webhookGet(50, 0)
        println("\nWebhooks (${webhooks.size}):")
        for (w in webhooks) {
            println(" - ${w.webhookID} ${w.name} ${w.url} enabled=${w.isEnabled}")
        }
    } catch (e: ApiException) {
        Ee.fail("list webhooks", e)
    }

    // 3. Rotate the signing secret. The old one stops working at once (no grace period).
    if (webhookId != null) {
        try {
            val rotated = webhookApi.webhookByPublicidSecretRotatePost(webhookId)
            println("\nNew signing secret (store it as ELASTICEMAIL_WEBHOOK_SECRET): ${rotated.signingSecret}")
        } catch (e: ApiException) {
            Ee.fail("rotate webhook secret", e)
        }
    }

    // 4. Delete the one we created (comment out to keep it)
    if (webhookId != null) {
        try {
            webhookApi.webhookByPublicidDelete(webhookId)
            println("\nWebhook deleted: $webhookId")
        } catch (e: ApiException) {
            Ee.fail("delete webhook", e)
        }
    }
}
