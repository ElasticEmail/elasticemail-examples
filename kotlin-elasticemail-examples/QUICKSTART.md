# Send your first email with Kotlin

Five minutes from a clean clone to a delivered email, calling the Elastic Email Java SDK from Kotlin
on the JVM. Works as a plain `main` function or behind a Ktor 3 server.

## Prerequisites

- Java 17+ and Maven 3.8+ (Maven downloads the Kotlin compiler, so there is nothing else to install)
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

Creating and managing keys is covered in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

Kotlin uses the Java SDK. It is not on Maven Central and comes from JitPack, which the `pom.xml`
already configures next to the `kotlin-maven-plugin`:

```xml
<repository>
  <id>jitpack.io</id>
  <url>https://jitpack.io</url>
</repository>

<dependency>
  <groupId>com.github.ElasticEmail</groupId>
  <artifactId>elasticemail-java</artifactId>
  <version>4.2.0</version>
</dependency>
```

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/kotlin-elasticemail-examples

mvn compile          # first build pulls the SDK from JitPack and the Kotlin compiler from Maven Central
cp .env.example .env
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

The examples and the Ktor app read it through `dotenv-java`, and real environment variables work
too. Full list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

```kotlin
import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import com.elasticemail.client.Configuration
import com.elasticemail.client.auth.ApiKeyAuth
import com.elasticemail.model.*

fun main() {
    val client = Configuration.getDefaultApiClient()
    (client.getAuthentication("apikey") as ApiKeyAuth).apiKey = System.getenv("ELASTICEMAIL_API_KEY")

    val data = EmailTransactionalMessageData()
        .recipients(TransactionalRecipient().to(listOf(System.getenv("EMAIL_TO"))))
        .content(
            EmailContent()
                .from(System.getenv("EMAIL_FROM"))
                .subject("Hello from Elastic Email!")
                .body(listOf(
                    BodyPart().contentType(BodyContentType.HTML).content("<h1>Welcome!</h1>"),
                    BodyPart().contentType(BodyContentType.PLAIN_TEXT).content("Welcome!"),
                )),
        )

    try {
        val result = EmailsApi(client).emailsTransactionalPost(data)
        println("Transaction ID: ${result.transactionID}")
    } catch (e: ApiException) {
        System.err.println("${e.code} ${e.responseBody}")   // {"Error": "..."}
    }
}
```

The SDK models are Java fluent builders, and Kotlin reads their getters as properties
(`result.transactionID`). Body content types are the `BodyContentType` enum rather than strings.

Run the version in this repository. A top-level `main` in `BasicSend.kt` compiles to the class
`BasicSendKt`:

```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.BasicSendKt
```

`Ee.kt` holds the shared setup: `client()`, `from()`, `to()`, `printApiError()` and `fail()`.

## 6. Or run the Ktor app

```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.ktor.AppKt
```

It listens on 3000 (set `PORT` to change it) and exposes the same routes as every other stack:

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Kotlin!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## Next steps

```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.BatchSendKt
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.WithAttachmentsKt
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.WithTemplateKt
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.WebhooksKt
```

Arguments go through `-Dexec.args="..."`:

```bash
mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.EmailStatusKt -Dexec.args="<transactionId>"
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every example and route | [README.md](README.md) |
