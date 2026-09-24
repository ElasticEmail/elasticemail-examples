# Kotlin Email API Examples - Elastic Email

Send transactional and bulk email from Kotlin with the [Elastic Email](https://elasticemail.com/email-api) email API. Top-level `main` functions call the official Elastic Email Java SDK directly from Kotlin on the JVM, and a Ktor 3 server on Netty exposes the same use cases as HTTP routes. Everything builds with Maven and the `kotlin-maven-plugin`.

> **First time here?** The [Kotlin quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `com.github.ElasticEmail:elasticemail-java:4.2.0 (JitPack)` · Java 17+, Maven 3.8+ · Kotlin 2.4, Ktor 3.6

## Prerequisites

- Java 17+ (the Kotlin compiler comes from Maven, no separate install needed)
- Maven 3.8+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

There is no Kotlin-specific SDK. Kotlin calls the Elastic Email Java SDK, which is not on Maven
Central: the `pom.xml` pulls it from JitPack (`com.github.ElasticEmail:elasticemail-java:4.2.0`), so
the first build downloads it from there.

```bash
# Install dependencies and compile
mvn compile

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

## Standalone Examples

Run every command from this folder. Each example is a file with a top-level `fun main`, so Kotlin
compiles it to a class named after the file with a `Kt` suffix (`BasicSend.kt` -> `BasicSendKt`).
`mvn -q compile exec:java` recompiles when needed and then runs the class.

### Basic Email Sending
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.BasicSendKt
```

### Batch Sending
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.BatchSendKt
```

### With Attachments
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.WithAttachmentsKt
```

### With CID (Inline) Attachments
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.WithCidAttachmentsKt
```

### Using Templates
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.WithTemplateKt
```

### Scheduled Sending
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.ScheduledSendKt
```

### Prevent Gmail Threading
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.PreventThreadingKt
```

### Contacts and Lists
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.ContactsKt
```

### Domain Management
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.DomainsKt
```

### Email Status
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.EmailStatusKt -Dexec.args="<transactionId> [messageId]"
```

### Webhooks
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.WebhooksKt
```

### Inbound Routes
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.InboundKt
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.DoubleOptinSubscribeKt -Dexec.args="user@example.com 'John Doe'"

# Click-tracking based confirmation server (Ktor)
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.DoubleOptinWebhookKt
```

### Suppressions
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.SuppressionsKt -Dexec.args="someone@example.com"
```

### Email Verification
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.EmailVerificationKt -Dexec.args="someone@example.com"
```

### Statistics
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.StatisticsKt
```

### Sub-Accounts
```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.SubAccountsKt
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.SubAccountsKt
```

## Ktor Application

`ktor_app/App.kt` is compiled together with the examples, so run it from this folder. It uses the
Netty engine and Jackson for JSON.

```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.ktor.AppKt

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Ktor!"}'
```

## API Endpoints

The Ktor app exposes the same routes and JSON shapes as every other stack in this repository.

- `GET /health` -> `{"status": "ok"}`
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`
- `GET|POST /webhook?token=...` - Elastic Email event notifications. Elastic Email sends each event as a GET request with the details in the query string (`status`, `to`, `transaction`, `messageid`, `target`, ...). The `token` must match `ELASTICEMAIL_WEBHOOK_TOKEN`; the comparison is constant-time (`MessageDigest.isEqual`).
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link signed with HMAC-SHA256
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `GET|POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

Inbound email carries attachments as base64 form fields, so requests can be several megabytes. The
other stacks raise their body limit to 25 MB explicitly. This app keeps Ktor's defaults, so if you
put it behind a reverse proxy or load balancer, raise that proxy's request-size limit instead (for
example `client_max_body_size 25m;` in nginx).

## Quick Usage

```kotlin
import com.elasticemail.api.EmailsApi
import com.elasticemail.client.Configuration
import com.elasticemail.client.auth.ApiKeyAuth
import com.elasticemail.model.*

val client = Configuration.getDefaultApiClient()
(client.getAuthentication("apikey") as ApiKeyAuth).apiKey = "your_api_key"

val result = EmailsApi(client).emailsTransactionalPost(
    EmailTransactionalMessageData()
        .recipients(TransactionalRecipient().to(listOf("you@yourdomain.com")))
        .content(
            EmailContent()
                .from("Acme <hello@yourdomain.com>")
                .subject("Hello")
                .body(listOf(
                    BodyPart().contentType(BodyContentType.HTML).content("<p>Hello World</p>"),
                    BodyPart().contentType(BodyContentType.PLAIN_TEXT).content("Hello World"),
                )),
        ),
)

println("${result.transactionID} ${result.messageID}")
```

## Project Structure

```
kotlin-elasticemail-examples/
├── src/main/kotlin/com/elasticemail/examples/
│   ├── Ee.kt                        # Shared config (API key, env values, error printing)
│   ├── BasicSend.kt                 # Simple transactional email
│   ├── BatchSend.kt                 # Bulk send with merge fields
│   ├── WithAttachments.kt           # Emails with files
│   ├── WithCidAttachments.kt        # Inline images
│   ├── WithTemplate.kt              # Templates with merge values
│   ├── ScheduledSend.kt             # Delayed delivery (TimeOffset)
│   ├── PreventThreading.kt          # Prevent Gmail threading
│   ├── Contacts.kt                  # Contacts and lists
│   ├── Domains.kt                   # Domain verification
│   ├── EmailStatus.kt               # Delivery status by transaction id
│   ├── Webhooks.kt                  # Manage webhooks
│   ├── Inbound.kt                   # Manage inbound routes
│   ├── DoubleOptinSubscribe.kt      # Double opt-in: subscribe
│   ├── DoubleOptinWebhook.kt        # Double opt-in: click-based confirm server (Ktor)
│   ├── Suppressions.kt              # Unsubscribes, bounces, complaints
│   ├── EmailVerification.kt         # Verify an address
│   ├── Statistics.kt                # Account statistics
│   └── SubAccounts.kt               # Sub-accounts (read-only by default)
├── ktor_app/
│   └── App.kt                       # Ktor web app
├── pom.xml
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email Java SDK](https://github.com/ElasticEmail/elasticemail-java) - the SDK these Kotlin examples call
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)
- [Java examples](../java-elasticemail-examples/) - the same use cases in Java, with Javalin and Spring Boot

## License

MIT
