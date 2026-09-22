# Send your first email with Java

Five minutes from a clean clone to a delivered email, using the Elastic Email Java SDK. Works plain,
with Javalin or with Spring Boot.

## Prerequisites

- Java 17+ and Maven 3.8+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

The SDK is not on Maven Central. It comes from JitPack, which the `pom.xml` already configures:

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
cd elasticemail-examples/java-elasticemail-examples

mvn compile          # first build pulls the SDK from JitPack
cp .env.example .env
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

The standalone examples read it through `dotenv-java`. The Spring Boot app expects real environment
variables instead - `export ELASTICEMAIL_API_KEY=...` before `mvn spring-boot:run`. Full list in
[docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

```java
import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiClient;
import com.elasticemail.client.ApiException;
import com.elasticemail.client.Configuration;
import com.elasticemail.client.auth.ApiKeyAuth;
import com.elasticemail.model.*;

import java.util.List;

public class Send {
    public static void main(String[] args) {
        ApiClient client = Configuration.getDefaultApiClient();
        ((ApiKeyAuth) client.getAuthentication("apikey")).setApiKey(System.getenv("ELASTICEMAIL_API_KEY"));

        EmailTransactionalMessageData data = new EmailTransactionalMessageData()
                .recipients(new TransactionalRecipient().to(List.of(System.getenv("EMAIL_TO"))))
                .content(new EmailContent()
                        .from(System.getenv("EMAIL_FROM"))
                        .subject("Hello from Elastic Email!")
                        .body(List.of(
                                new BodyPart().contentType(BodyContentType.HTML).content("<h1>Welcome!</h1>"),
                                new BodyPart().contentType(BodyContentType.PLAIN_TEXT).content("Welcome!"))));

        try {
            EmailSend result = new EmailsApi(client).emailsTransactionalPost(data);
            System.out.println("Transaction ID: " + result.getTransactionID());
        } catch (ApiException e) {
            System.err.println(e.getCode() + " " + e.getResponseBody());   // {"Error": "..."}
        }
    }
}
```

Models are fluent builders, and body content types are the `BodyContentType` enum rather than
strings.

Run the version in this repository:

```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.BasicSend
```

`Ee.java` holds the shared setup: `client()`, `from()`, `to()` and `printApiError()`.

## 6. Or run a web app

```bash
# Javalin - compiled together with the examples
mvn -q exec:java -Dexec.mainClass=com.elasticemail.javalin.App

# Spring Boot
cd spring_boot_app
export ELASTICEMAIL_API_KEY=your_api_key
mvn spring-boot:run
```

Both listen on 3000 and expose the same routes:

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Java!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## Next steps

```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.BatchSend
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.WithAttachments
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.WithTemplate
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.Webhooks
```

Arguments go through `-Dexec.args="..."`:

```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.EmailStatus -Dexec.args="<transactionId>"
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every class and route | [README.md](README.md) |
