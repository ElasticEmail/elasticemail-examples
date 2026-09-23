# Java Email API Examples - Elastic Email

Send transactional and bulk email from Java with the [Elastic Email](https://elasticemail.com/email-api) email API. Standalone classes plus two web applications - Javalin and Spring Boot - built on the official Elastic Email Java SDK.

> **First time here?** The [Java quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `com.github.ElasticEmail:elasticemail-java:4.2.0 (JitPack)` · Java 17+, Maven 3.8+ · Javalin, Spring Boot 3.4

## Prerequisites

- Java 17+
- Maven 3.8+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

The Elastic Email Java SDK is not on Maven Central. The `pom.xml` pulls it from JitPack
(`com.github.ElasticEmail:elasticemail-java:4.2.0`), so the first build downloads it from there.

```bash
# Install dependencies and compile
mvn compile

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

## Standalone Examples

Run every command from this folder. `mvn -q exec:java` recompiles when needed.

### Basic Email Sending
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.BasicSend
```

### Batch Sending
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.BatchSend
```

### With Attachments
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.WithAttachments
```

### With CID (Inline) Attachments
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.WithCidAttachments
```

### Using Templates
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.WithTemplate
```

### Scheduled Sending
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.ScheduledSend
```

### Prevent Gmail Threading
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.PreventThreading
```

### Contacts and Lists
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.Contacts
```

### Domain Management
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.Domains
```

### Email Status
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.EmailStatus -Dexec.args="<transactionId> [messageId]"
```

### Webhooks
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.Webhooks
```

### Inbound Routes
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.Inbound
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.DoubleOptinSubscribe -Dexec.args="user@example.com 'John Doe'"

# Click-tracking based confirmation server (Javalin)
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.DoubleOptinWebhook
```

### Suppressions
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.Suppressions -Dexec.args="someone@example.com"
```

### Email Verification
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.EmailVerification -Dexec.args="someone@example.com"
```

### Statistics
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.Statistics
```

### Sub-Accounts
```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.SubAccounts
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.SubAccounts
```

## Javalin Application

`javalin_app/App.java` is compiled together with the examples, so run it from this folder.

```bash
mvn -q exec:java -Dexec.mainClass=com.elasticemail.javalin.App

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Javalin!"}'
```

## Spring Boot Application

```bash
cd spring_boot_app
export ELASTICEMAIL_API_KEY=your_api_key
mvn spring-boot:run

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Spring Boot!"}'
```

See `spring_boot_app/README.md` for the full list of environment variables.

## API Endpoints

Both server apps expose the same routes and JSON shapes.

- `GET /health` -> `{"status": "ok"}`
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`
- `GET|POST /webhook?token=...` - Elastic Email event notifications. Elastic Email sends each event as a GET request with the details in the query string (`status`, `to`, `transaction`, `messageid`, `target`, ...). The `token` must match `ELASTICEMAIL_WEBHOOK_TOKEN`; the comparison is constant-time.
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link signed with HMAC-SHA256
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

## Quick Usage

```java
import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiClient;
import com.elasticemail.client.Configuration;
import com.elasticemail.client.auth.ApiKeyAuth;
import com.elasticemail.model.*;
import java.util.List;

ApiClient client = Configuration.getDefaultApiClient();
((ApiKeyAuth) client.getAuthentication("apikey")).setApiKey("your_api_key");

EmailSend result = new EmailsApi(client).emailsTransactionalPost(new EmailTransactionalMessageData()
        .recipients(new TransactionalRecipient().to(List.of("you@yourdomain.com")))
        .content(new EmailContent()
                .from("Acme <hello@yourdomain.com>")
                .subject("Hello")
                .body(List.of(new BodyPart().contentType(BodyContentType.HTML).content("<p>Hello World</p>")))));

System.out.println(result.getTransactionID() + " " + result.getMessageID());
```

## Project Structure

```
java-elasticemail-examples/
├── src/main/java/com/elasticemail/examples/
│   ├── Ee.java                      # Shared config (API key, env values, error printing)
│   ├── BasicSend.java               # Simple transactional email
│   ├── BatchSend.java               # Bulk send with merge fields
│   ├── WithAttachments.java         # Emails with files
│   ├── WithCidAttachments.java      # Inline images
│   ├── WithTemplate.java            # Templates with merge values
│   ├── ScheduledSend.java           # Delayed delivery (TimeOffset)
│   ├── PreventThreading.java        # Prevent Gmail threading
│   ├── Contacts.java                # Contacts and lists
│   ├── Domains.java                 # Domain verification
│   ├── EmailStatus.java             # Delivery status by transaction id
│   ├── Webhooks.java                # Manage webhooks
│   ├── Inbound.java                 # Manage inbound routes
│   ├── DoubleOptinSubscribe.java    # Double opt-in: subscribe
│   ├── DoubleOptinWebhook.java      # Double opt-in: click-based confirm server
│   ├── Suppressions.java            # Unsubscribes, bounces, complaints
│   ├── EmailVerification.java       # Verify an address
│   ├── Statistics.java              # Account statistics
│   └── SubAccounts.java             # Sub-accounts (read-only by default)
├── javalin_app/
│   └── App.java                     # Javalin web app
├── spring_boot_app/                 # Spring Boot app
│   ├── src/main/java/...
│   ├── pom.xml
│   └── README.md
├── pom.xml
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email Java SDK](https://github.com/ElasticEmail/elasticemail-java)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
