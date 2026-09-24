package com.elasticemail.ktor

import com.elasticemail.api.ContactsApi
import com.elasticemail.api.EmailsApi
import com.elasticemail.api.ListsApi
import com.elasticemail.client.ApiException
import com.elasticemail.client.Configuration
import com.elasticemail.client.auth.ApiKeyAuth
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.ContactPayload
import com.elasticemail.model.ContactStatus
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailTransactionalMessageData
import com.elasticemail.model.EmailsPayload
import com.elasticemail.model.MessageAttachment
import com.elasticemail.model.TransactionalRecipient
import com.fasterxml.jackson.databind.ObjectMapper
import io.github.cdimascio.dotenv.Dotenv
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.jackson.jackson
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.contentType
import io.ktor.server.request.receive
import io.ktor.server.request.receiveParameters
import io.ktor.server.response.respond
import io.ktor.server.response.respondRedirect
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.Base64
import java.util.HexFormat
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.system.exitProcess

private val dotenv: Dotenv = Dotenv.configure().ignoreIfMissing().load()

private fun env(name: String): String? = dotenv.get(name)?.takeIf { it.isNotEmpty() }

private fun env(name: String, defaultValue: String): String = env(name) ?: defaultValue

private val from = env("EMAIL_FROM", "Acme <hello@yourdomain.com>")
private val contactEmail = env("CONTACT_EMAIL", from)
private val listName = env("ELASTICEMAIL_LIST_NAME", "Newsletter")
private val publicUrl = env("PUBLIC_URL", "http://localhost:3000")
private val secret = env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
private val confirmRedirectUrl = env("CONFIRM_REDIRECT_URL")

private lateinit var emailsApi: EmailsApi
private lateinit var contactsApi: ContactsApi
private lateinit var listsApi: ListsApi

fun main() {
    val apiKey = env("ELASTICEMAIL_API_KEY")
    if (apiKey == null) {
        System.err.println("ELASTICEMAIL_API_KEY environment variable is required")
        exitProcess(1)
    }

    val client = Configuration.getDefaultApiClient()
    (client.getAuthentication("apikey") as ApiKeyAuth).apiKey = apiKey
    emailsApi = EmailsApi(client)
    contactsApi = ContactsApi(client)
    listsApi = ListsApi(client)

    val port = env("PORT", "3000").toInt()
    embeddedServer(Netty, port = port, module = Application::module).start(wait = true)
}

fun Application.module() {
    install(ContentNegotiation) { jackson() }

    routing {
        get("/health") { call.respond(mapOf("status" to "ok")) }
        post("/send") { send(call) }
        route("/webhook") {
            get { webhook(call) }
            post { webhook(call) }
        }
        post("/inbound") { inbound(call) }
        post("/double-optin/subscribe") { doubleOptinSubscribe(call) }
        get("/double-optin/confirm") { doubleOptinConfirm(call) }
        route("/double-optin/webhook") {
            get { doubleOptinWebhook(call) }
            post { doubleOptinWebhook(call) }
        }
    }

    println("Ktor server running on http://localhost:${env("PORT", "3000")}")
}

private suspend fun send(call: ApplicationCall) {
    val body = jsonBody(call)
    val to = body["to"]
    val subject = body["subject"]
    val message = body["message"]

    if (to == null || subject == null || message == null) {
        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing required fields: to, subject, message"))
        return
    }

    try {
        val result = emailsApi.emailsTransactionalPost(
            EmailTransactionalMessageData()
                .recipients(TransactionalRecipient().to(listOf(to)))
                .content(
                    EmailContent()
                        .from(from)
                        .subject(subject)
                        .body(
                            listOf(
                                BodyPart().contentType(BodyContentType.HTML).content("<p>$message</p>"),
                                BodyPart().contentType(BodyContentType.PLAIN_TEXT).content(message),
                            ),
                        ),
                ),
        )
        call.respond(mapOf("success" to true, "transactionId" to result.transactionID, "messageId" to result.messageID))
    } catch (e: ApiException) {
        apiError(call, e)
    }
}

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
private suspend fun webhook(call: ApplicationCall) {
    if (!tokenOk(call.request.queryParameters["token"])) {
        call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid token"))
        return
    }

    val event = params(call)
    val status = sanitize(event["status"])

    if (status.isEmpty()) {
        // Validation ping or empty request
        call.respond(mapOf("ok" to true))
        return
    }

    println("Webhook event: $status to: ${sanitize(event["to"])} transaction: ${sanitize(event["transaction"])}")

    when (status) {
        "Sent" -> println("Email sent, message id: ${sanitize(event["messageid"])}")
        "Opened" -> println("Email opened from ${sanitize(event["Country"])} ${sanitize(event["City"])}")
        "Clicked" -> println("Link clicked: ${sanitize(event["target"])}")
        "Error" -> println("Bounce/error, category: ${sanitize(event["category"])}")
        "AbuseReport" -> println("Complaint received")
        "Unsubscribed" -> println("Recipient unsubscribed")
    }

    call.respond(mapOf("received" to true, "status" to status))
}

// Inbound email pushed by an inbound route with ActionType NotifyViaHttp.
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
private suspend fun inbound(call: ApplicationCall) {
    if (!tokenOk(call.request.queryParameters["token"])) {
        call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid token"))
        return
    }

    val mail = params(call)
    val attachmentNames = mutableListOf<String>()
    val attachments = mutableListOf<MessageAttachment>()
    for ((key, name) in mail) {
        if (!Regex("^att\\d+_name$").matches(key)) continue
        attachmentNames += name
        val content = mail[key.replace("_name", "_content")]
        if (!content.isNullOrEmpty()) {
            attachments += MessageAttachment().name(name).binaryContent(Base64.getMimeDecoder().decode(content))
        }
    }

    println("Inbound email from: ${sanitize(mail["from_email"])} subject: ${sanitize(mail["subject"])}")
    println("Attachments: ${if (attachmentNames.isEmpty()) "none" else attachmentNames.joinToString(", ")}")

    val subject = mail["subject"] ?: "(no subject)"
    val bodyText = mail["body_text"].orEmpty()
    val bodyHtml = mail["body_html"]?.takeIf { it.isNotEmpty() } ?: "<pre>${bodyText.replace("<", "&lt;")}</pre>"

    // Forward a copy to the team inbox
    try {
        val body = mutableListOf(BodyPart().contentType(BodyContentType.HTML).content(bodyHtml))
        if (bodyText.isNotEmpty()) {
            body += BodyPart().contentType(BodyContentType.PLAIN_TEXT).content(bodyText)
        }
        val content = EmailContent()
            .from(from)
            .replyTo(mail["from_email"])
            .subject("Fwd: $subject")
            .body(body)
        if (attachments.isNotEmpty()) {
            content.attachments(attachments)
        }
        val result = emailsApi.emailsTransactionalPost(
            EmailTransactionalMessageData()
                .recipients(TransactionalRecipient().to(listOf(contactEmail)))
                .content(content),
        )
        call.respond(mapOf("received" to true, "forwardedMessageId" to result.messageID))
    } catch (e: ApiException) {
        apiError(call, e)
    }
}

private suspend fun doubleOptinSubscribe(call: ApplicationCall) {
    val body = jsonBody(call)
    val email = body["email"]
    val name = body["name"].orEmpty()

    if (email.isNullOrEmpty()) {
        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing required field: email"))
        return
    }

    val confirmUrl = "$publicUrl/double-optin/confirm?email=${URLEncoder.encode(email, Charsets.UTF_8)}&token=${hmac(email)}"
    val greeting = if (name.isEmpty()) "Welcome!" else "Welcome, $name!"

    try {
        // Stored as Transactional so it receives the confirmation but no campaigns yet
        contactsApi.contactsPost(
            listOf(
                ContactPayload()
                    .email(email)
                    .firstName(name.trim().split(Regex("\\s+"), limit = 2)[0])
                    .status(ContactStatus.TRANSACTIONAL),
            ),
            null,
        )

        val html = "<div style=\"text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;\">" +
            "<h1>$greeting</h1>" +
            "<p>Please confirm your subscription to our newsletter.</p>" +
            "<a href=\"$confirmUrl\" style=\"background-color: #18181b; color: #fff; padding: 12px 32px; " +
            "border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;\">Confirm Subscription</a>" +
            "</div>"

        val result = emailsApi.emailsTransactionalPost(
            EmailTransactionalMessageData()
                .recipients(TransactionalRecipient().to(listOf(email)))
                .content(
                    EmailContent()
                        .from(from)
                        .subject("Confirm your subscription")
                        .body(
                            listOf(
                                BodyPart().contentType(BodyContentType.HTML).content(html),
                                BodyPart()
                                    .contentType(BodyContentType.PLAIN_TEXT)
                                    .content("$greeting\n\nConfirm your subscription: $confirmUrl"),
                            ),
                        ),
                ),
        )

        call.respond(mapOf("success" to true, "message" to "Confirmation email sent", "messageId" to result.messageID))
    } catch (e: ApiException) {
        apiError(call, e)
    }
}

private suspend fun doubleOptinConfirm(call: ApplicationCall) {
    val email = call.request.queryParameters["email"].orEmpty()
    val token = call.request.queryParameters["token"].orEmpty()

    val expected = hmac(email).toByteArray(Charsets.UTF_8)
    if (email.isEmpty() || !MessageDigest.isEqual(expected, token.toByteArray(Charsets.UTF_8))) {
        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid confirmation link"))
        return
    }

    try {
        listsApi.listsByNameContactsPost(listName, EmailsPayload().emails(listOf(email)))
        if (confirmRedirectUrl != null) {
            call.respondRedirect(confirmRedirectUrl)
            return
        }
        call.respond(mapOf("confirmed" to true, "email" to email, "list" to listName))
    } catch (e: ApiException) {
        apiError(call, e)
    }
}

// Click-tracking based confirmation: create a webhook for Clicked events pointing here.
private suspend fun doubleOptinWebhook(call: ApplicationCall) {
    if (!tokenOk(call.request.queryParameters["token"])) {
        call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid token"))
        return
    }

    val event = params(call)
    val status = sanitize(event["status"])
    val target = event["target"].orEmpty()
    val to = sanitize(event["to"])

    if (status != "Clicked" || !target.contains("/double-optin/confirm")) {
        call.respond(mapOf("received" to true, "status" to status, "message" to "Event ignored"))
        return
    }

    try {
        listsApi.listsByNameContactsPost(listName, EmailsPayload().emails(listOf(to)))
        call.respond(mapOf("received" to true, "confirmed" to true, "email" to to))
    } catch (e: ApiException) {
        apiError(call, e)
    }
}

/** JSON body as a map of strings; missing or malformed bodies become an empty map. */
private suspend fun jsonBody(call: ApplicationCall): Map<String, String?> = try {
    call.receive<Map<String, Any?>>().mapValues { (_, v) -> v?.toString() }
} catch (e: Exception) {
    emptyMap()
}

/** Query string parameters first, form fields override (Elastic Email posts form-encoded). */
private suspend fun params(call: ApplicationCall): Map<String, String> {
    val merged = mutableMapOf<String, String>()
    call.request.queryParameters.forEach { k, v -> merged[k] = v.firstOrNull().orEmpty() }
    if (call.request.contentType().match(ContentType.Application.FormUrlEncoded)) {
        call.receiveParameters().forEach { k, v -> merged[k] = v.firstOrNull().orEmpty() }
    }
    return merged
}

/** Strip newlines from user-controlled values before logging */
private fun sanitize(value: String?): String = value.orEmpty().replace(Regex("[\\r\\n]"), "")

/** Constant-time comparison of the shared secret carried in ?token= */
private fun tokenOk(token: String?): Boolean =
    MessageDigest.isEqual(token.orEmpty().toByteArray(Charsets.UTF_8), secret.toByteArray(Charsets.UTF_8))

private fun hmac(value: String): String {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
    return HexFormat.of().formatHex(mac.doFinal(value.toByteArray(Charsets.UTF_8)))
}

/** Responds with the API status code and the Error message from the response body ({"Error": "..."}). */
private suspend fun apiError(call: ApplicationCall, e: ApiException) {
    val status = if (e.code >= 400) e.code else 500
    val body = e.responseBody?.takeIf { it.isNotEmpty() }
    val apiMessage = body?.let { runCatching { mapper.readTree(it).path("Error").asText("") }.getOrNull() }
    val message = apiMessage?.takeIf { it.isNotEmpty() } ?: body ?: e.message ?: "Unknown error"
    call.respond(HttpStatusCode.fromValue(status), mapOf("error" to message))
}

private val mapper = ObjectMapper()
