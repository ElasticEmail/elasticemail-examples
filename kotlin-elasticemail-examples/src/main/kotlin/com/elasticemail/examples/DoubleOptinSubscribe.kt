package com.elasticemail.examples

import com.elasticemail.api.ContactsApi
import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.BodyContentType
import com.elasticemail.model.BodyPart
import com.elasticemail.model.ContactPayload
import com.elasticemail.model.ContactStatus
import com.elasticemail.model.EmailContent
import com.elasticemail.model.EmailTransactionalMessageData
import com.elasticemail.model.TransactionalRecipient
import java.net.URLEncoder
import java.util.HexFormat
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    // Usage: mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.DoubleOptinSubscribeKt -Dexec.args="user@example.com 'John Doe'"
    val email = args.getOrNull(0)
    if (email.isNullOrEmpty()) {
        System.err.println("Usage: DoubleOptinSubscribe <email> [\"Name\"]")
        exitProcess(1)
    }
    val name = args.getOrNull(1).orEmpty()

    val client = Ee.client()
    val contactsApi = ContactsApi(client)
    val emailsApi = EmailsApi(client)

    val from = Ee.from()
    val publicUrl = Ee.env("PUBLIC_URL", "http://localhost:3000")
    val secret = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")

    // The confirm link carries an HMAC of the email so the confirm endpoint can trust it.
    val confirmToken = hmacSha256Hex(secret, email)
    val confirmUrl = "$publicUrl/double-optin/confirm?email=${URLEncoder.encode(email, Charsets.UTF_8)}&token=$confirmToken"

    val parts = name.trim().split(Regex("\\s+"), limit = 2)
    val firstName = parts[0]
    val lastName = parts.getOrElse(1) { "" }

    try {
        // Step 1: store the contact without adding it to the marketing list.
        // Status Transactional allows sending the confirmation but excludes it from campaigns.
        contactsApi.contactsPost(
            listOf(
                ContactPayload()
                    .email(email)
                    .firstName(firstName)
                    .lastName(lastName)
                    .status(ContactStatus.TRANSACTIONAL),
            ),
            null,
        )
        println("Contact stored (unconfirmed): $email")

        // Step 2: send the confirmation email
        val greeting = if (name.isEmpty()) "Welcome!" else "Welcome, $name!"
        val html = """
            <div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
              <h1>$greeting</h1>
              <p>Please confirm your subscription to our newsletter.</p>
              <a href="$confirmUrl" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
            </div>
        """.trimIndent()

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

        println("Confirmation email sent. Message ID: ${result.messageID}")
        println("Confirm URL: $confirmUrl")
        println("\nWhen the link is opened, GET /double-optin/confirm in ktor_app/App.kt adds the contact to the list.")
    } catch (e: ApiException) {
        Ee.fail("double opt-in subscribe", e)
    }
}

internal fun hmacSha256Hex(secret: String, message: String): String {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
    return HexFormat.of().formatHex(mac.doFinal(message.toByteArray(Charsets.UTF_8)))
}
