package com.elasticemail.examples

import com.elasticemail.api.ListsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.EmailsPayload
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.jackson.jackson
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.contentType
import io.ktor.server.request.receiveParameters
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import java.security.MessageDigest

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
    val port = Ee.env("PORT", "3000").toInt()

    fun tokenOk(token: String?): Boolean =
        MessageDigest.isEqual(token.orEmpty().toByteArray(Charsets.UTF_8), expectedToken.toByteArray(Charsets.UTF_8))

    suspend fun handle(call: ApplicationCall) {
        if (!tokenOk(call.request.queryParameters["token"])) {
            call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid token"))
            return
        }

        val event = webhookParams(call)
        val status = sanitize(event["status"])
        val target = sanitize(event["target"])
        val recipient = sanitize(event["to"])

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
            // Elastic Email validates the URL with a GET when the webhook is saved,
            // and delivers events as GET requests with the data in the query string.
            get("/double-optin/webhook") { handle(call) }
            post("/double-optin/webhook") { handle(call) }
        }
        println("Double opt-in webhook listening on http://localhost:$port/double-optin/webhook")
    }.start(wait = true)
}

/** Query string parameters first, form fields override (Elastic Email may post form-encoded). */
private suspend fun webhookParams(call: ApplicationCall): Map<String, String> {
    val merged = mutableMapOf<String, String>()
    call.request.queryParameters.forEach { k, v -> merged[k] = v.firstOrNull().orEmpty() }
    if (call.request.contentType().match(ContentType.Application.FormUrlEncoded)) {
        call.receiveParameters().forEach { k, v -> merged[k] = v.firstOrNull().orEmpty() }
    }
    return merged
}

private fun sanitize(value: String?): String = value.orEmpty().replace(Regex("[\\r\\n]"), "")
