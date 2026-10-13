package com.elasticemail.examples

import com.elasticemail.client.ApiClient
import com.elasticemail.client.ApiException
import com.elasticemail.client.Configuration
import com.elasticemail.client.auth.ApiKeyAuth
import com.fasterxml.jackson.databind.ObjectMapper
import io.github.cdimascio.dotenv.Dotenv
import java.net.URLDecoder
import java.security.MessageDigest
import java.util.HexFormat
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.abs
import kotlin.system.exitProcess

/**
 * Shared setup for the standalone examples and ktor_app: loads .env, builds an authenticated
 * ApiClient, exposes the common environment values and verifies webhook requests.
 */
object Ee {
    private val dotenv: Dotenv = Dotenv.configure().ignoreIfMissing().load()

    fun env(name: String, defaultValue: String): String = env(name) ?: defaultValue

    fun env(name: String): String? = dotenv.get(name)?.takeIf { it.isNotEmpty() }

    fun from(): String = env("EMAIL_FROM", "Acme <hello@yourdomain.com>")

    fun to(): String = env("EMAIL_TO", "you@yourdomain.com")

    fun client(): ApiClient {
        val apiKey = env("ELASTICEMAIL_API_KEY")
        if (apiKey == null) {
            System.err.println("ELASTICEMAIL_API_KEY environment variable is required")
            exitProcess(1)
        }

        val client = Configuration.getDefaultApiClient()
        (client.getAuthentication("apikey") as ApiKeyAuth).apiKey = apiKey
        return client
    }

    /** Prints the HTTP status and the API error body, e.g. {"Error":"..."}. */
    fun printApiError(step: String, e: ApiException) {
        System.err.println("Error ($step): ${e.code} ${errorBody(e)}")
    }

    fun errorBody(e: ApiException): String =
        e.responseBody?.takeIf { it.isNotEmpty() } ?: e.message.orEmpty()

    /** Prints the API error and exits with status 1. */
    fun fail(step: String, e: ApiException): Nothing {
        printApiError(step, e)
        exitProcess(1)
    }

    // ---- Webhook signatures -------------------------------------------------------------------

    /** How far (seconds) X-ElasticEmail-Timestamp may be from the current time. */
    const val SIGNATURE_TOLERANCE_SECONDS = 300L

    private val json = ObjectMapper()

    /**
     * Checks an Elastic Email webhook signature:
     * hex(HMAC-SHA256(secret, timestamp + "\n" + METHOD + "\n" + target + "\n" + body)), where
     * target is the path and query exactly as received on the request line. The signature header
     * is a comma-separated list; any matching `v1=` entry is accepted.
     */
    fun verifySignature(
        secret: String,
        timestamp: String?,
        signature: String?,
        method: String,
        target: String,
        body: ByteArray,
        nowSeconds: Long = System.currentTimeMillis() / 1000,
    ): Boolean {
        if (secret.isEmpty() || timestamp == null || signature == null) return false
        val ts = timestamp.toLongOrNull() ?: return false
        if (abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) return false
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        mac.update("$timestamp\n$method\n$target\n".toByteArray(Charsets.UTF_8))
        val expected = HexFormat.of().formatHex(mac.doFinal(body)).toByteArray(Charsets.UTF_8)
        return signature.split(",").map { it.trim() }.filter { it.startsWith("v1=") }
            .any { MessageDigest.isEqual(it.removePrefix("v1=").toByteArray(Charsets.UTF_8), expected) }
    }

    /** Result of [readWebhook]: the event fields (lower-cased names), or the status and error to answer with. */
    class WebhookRequest(val event: Map<String, String>?, val status: Int = 200, val error: String? = null)

    /**
     * Authenticates an event notification and returns its fields under lower-cased names.
     * With a signing secret (ELASTICEMAIL_WEBHOOK_SECRET) the request must carry a valid signature;
     * without one it must carry `?token=` equal to [token]. Signed webhooks are usually POST with a
     * JSON body; GET webhooks carry the fields in the query string. [target] is the raw path and
     * query and [body] the raw bytes, read before any parsing. A 401 makes Elastic Email retry.
     */
    fun readWebhook(
        secret: String,
        token: String,
        method: String,
        target: String,
        header: (String) -> String?,
        body: ByteArray,
    ): WebhookRequest {
        val query = parseForm(target.substringAfter('?', ""))

        if (secret.isNotEmpty()) {
            val valid = verifySignature(
                secret, header("X-ElasticEmail-Timestamp"), header("X-ElasticEmail-Signature"), method, target, body,
            )
            if (!valid) return WebhookRequest(null, 401, "Invalid signature")
        } else if (!MessageDigest.isEqual(query["token"].orEmpty().toByteArray(Charsets.UTF_8), token.toByteArray(Charsets.UTF_8))) {
            return WebhookRequest(null, 401, "Invalid token")
        }

        val event = query.toMutableMap()
        val text = body.toString(Charsets.UTF_8).trim()
        if (text.startsWith("{")) {
            // PostJson: a flat object; to, from, channel, subject and messageid may be null.
            val fields = try {
                json.readValue(text, Map::class.java)
            } catch (e: Exception) {
                return WebhookRequest(null, 400, "Invalid JSON body")
            }
            fields.forEach { (k, v) -> event[k.toString().lowercase()] = v?.toString().orEmpty() }
        } else if (text.isNotEmpty()) {
            event.putAll(parseForm(text))
        }
        return WebhookRequest(event)
    }

    /** Parses a URL-encoded query string or form body; names are lower-cased, first value wins. */
    private fun parseForm(encoded: String): Map<String, String> {
        val fields = mutableMapOf<String, String>()
        for (pair in encoded.split("&")) {
            if (pair.isEmpty()) continue
            val key = URLDecoder.decode(pair.substringBefore('='), Charsets.UTF_8).lowercase()
            val value = URLDecoder.decode(pair.substringAfter('=', ""), Charsets.UTF_8)
            fields.putIfAbsent(key, value)
        }
        return fields
    }
}
