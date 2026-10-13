package com.elasticemail.examples

import com.elasticemail.api.ListsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.EmailsPayload
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.jackson.jackson
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.httpMethod
import io.ktor.server.request.receive
import io.ktor.server.request.uri
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing

/**
 * Alternative confirmation flow driven by Elastic Email click tracking.
 * Create a webhook (see Webhooks.kt) pointing at /double-optin/webhook.
 * When the recipient clicks the confirm link, Elastic Email reports status=Clicked
 * with the clicked URL in "target". The contact is then added to the list.
 */
fun main(args: Array<String>) {
    val listsApi = ListsApi(Ee.client())
    val listName = Ee.env("ELASTICEMAIL_LIST_NAME", "Newsletter")
    val expectedToken = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
    val webhookSecret = Ee.env("ELASTICEMAIL_WEBHOOK_SECRET", "")
    val port = Ee.env("PORT", "3000").toInt()

    suspend fun handle(call: ApplicationCall) {
        // Signed webhooks (POST + JSON) are verified with ELASTICEMAIL_WEBHOOK_SECRET; unsigned ones
        // (GET + query string) with ?token=ELASTICEMAIL_WEBHOOK_TOKEN. The signature covers the raw
        // request target (call.request.uri, still URL-encoded) and the raw body bytes.
        val webhook = Ee.readWebhook(
            webhookSecret, expectedToken, call.request.httpMethod.value, call.request.uri,
            { call.request.headers[it] }, call.receive<ByteArray>(),
        )
        val event = webhook.event
        if (event == null) {
            call.respond(HttpStatusCode.fromValue(webhook.status), mapOf("error" to webhook.error))
            return
        }
        val status = sanitize(event["status"])
        val target = sanitize(event["target"])
        val recipient = sanitize(event["to"])

        // Test request sent when the webhook is saved.
        if (status.isEmpty()) {
            call.respond(mapOf("ok" to true))
            return
        }

        if (status != "Clicked" || !target.contains("/double-optin/confirm")) {
            call.respond(mapOf("received" to true, "status" to status, "message" to "Event ignored"))
            return
        }

        try {
            listsApi.listsByNameContactsPost(listName, EmailsPayload().emails(listOf(recipient)))
            println("Subscription confirmed via click: $recipient")
            call.respond(mapOf("received" to true, "confirmed" to true, "email" to recipient, "list" to listName))
        } catch (e: ApiException) {
            Ee.printApiError("add contact to list", e)
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to Ee.errorBody(e)))
        }
    }

    embeddedServer(Netty, port = port) {
        install(ContentNegotiation) { jackson() }
        routing {
            // Signed webhooks POST JSON; unsigned ones send GET requests with the data in the query string.
            get("/double-optin/webhook") { handle(call) }
            post("/double-optin/webhook") { handle(call) }
        }
        println("Double opt-in webhook listening on http://localhost:$port/double-optin/webhook")
    }.start(wait = true)
}

private fun sanitize(value: String?): String = value.orEmpty().replace(Regex("[\\r\\n]"), "")
