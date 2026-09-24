package com.elasticemail.examples

import com.elasticemail.api.WebhookApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.WebhookCreatePayload
import java.net.URLEncoder

fun main(args: Array<String>) {
    val webhookApi = WebhookApi(Ee.client())

    val publicUrl = Ee.env("PUBLIC_URL", "http://localhost:3000")
    val token = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")

    // Elastic Email does not sign webhook requests. The examples append a shared secret
    // as a query parameter and the receiving handler checks it.
    val webhookUrl = "$publicUrl/webhook?token=${URLEncoder.encode(token, Charsets.UTF_8)}"

    // 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
    //    and answer 2xx (use a tunnel such as ngrok for local development).
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
                .notificationForError(true),
        )
        println("Webhook created: ${created.webhookID} ${created.url}")
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

    // 3. Delete the one we created (comment out to keep it)
    if (webhookId != null) {
        try {
            webhookApi.webhookByPublicidDelete(webhookId)
            println("\nWebhook deleted: $webhookId")
        } catch (e: ApiException) {
            Ee.fail("delete webhook", e)
        }
    }
}
