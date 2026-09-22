# .NET Email API Examples (C#) - Elastic Email

Send transactional and bulk email from .NET and C# with the [Elastic Email](https://elasticemail.com/email-api) email API. Console examples plus two web applications - ASP.NET Minimal APIs and ASP.NET MVC - built on the official Elastic Email C# SDK.

> **First time here?** The [.NET quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- .NET 8.0 SDK
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from https://app.elasticemail.com/marketing/settings/new/manage-api

## Installation

```bash
# Restore dependencies
dotnet restore

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

## Standalone Examples

Run every command from this folder. `.env` is loaded automatically.

### Basic Email Sending
```bash
dotnet run -- basic-send
```

### Batch Sending
```bash
dotnet run -- batch-send
```

### With Attachments
```bash
dotnet run -- with-attachments
```

### With CID (Inline) Attachments
```bash
dotnet run -- with-cid-attachments
```

### Using Templates
```bash
dotnet run -- with-template
```

### Scheduled Sending
```bash
dotnet run -- scheduled-send
```

### Prevent Gmail Threading
```bash
dotnet run -- prevent-threading
```

### Contacts and Lists
```bash
dotnet run -- contacts
```

### Domain Management
```bash
dotnet run -- domains
```

### Email Status
```bash
dotnet run -- email-status <transactionId> [messageId]
```

### Webhooks
```bash
dotnet run -- webhooks
```

### Inbound Routes
```bash
dotnet run -- inbound
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
dotnet run -- double-optin-subscribe user@example.com "John Doe"

# Click-tracking based confirmation server
dotnet run -- double-optin-webhook
```

### Suppressions
```bash
dotnet run -- suppressions [email]
```

### Email Verification
```bash
dotnet run -- email-verification someone@example.com
```

### Statistics
```bash
dotnet run -- statistics
```

### Sub-Accounts
```bash
dotnet run -- sub-accounts
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true dotnet run -- sub-accounts
```

## Minimal API Application

```bash
cd MinimalApiApp
dotnet run

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Minimal API!"}'
```

## MVC Application

```bash
cd MvcApp
dotnet run

curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from MVC!"}'
```

Both apps read `PORT` and `ASPNETCORE_URLS` if set.

## API Endpoints

Both server apps expose the same routes and JSON shapes.

- `GET /health` -> `{"status": "ok"}`
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`
- `GET|POST /webhook?token=...` - Elastic Email event notifications. Parameters arrive in the query string or as form fields (`status`, `to`, `transaction`, `messageid`, `target`, ...). The `token` must match `ELASTICEMAIL_WEBHOOK_TOKEN`.
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

## Quick Usage

```csharp
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

var config = new Configuration();
config.AddApiKey("X-ElasticEmail-ApiKey", "your_api_key");
var emailsApi = new EmailsApi(config);

var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
    recipients: new TransactionalRecipient(to: new List<string> { "you@yourdomain.com" }),
    content: new EmailContent(
        from: "Acme <hello@yourdomain.com>",
        subject: "Hello",
        body: new List<BodyPart> { new BodyPart(BodyContentType.HTML, "<p>Hello World</p>") })));

Console.WriteLine($"{result.TransactionID} {result.MessageID}");
```

## Project Structure

```
dotnet-elasticemail-examples/
├── Program.cs                        # Dispatcher: dotnet run -- <example>
├── Examples/
│   ├── Ee.cs                         # Shared config (.env, API key, env values, error printing)
│   ├── BasicSend.cs                  # Simple transactional email
│   ├── BatchSend.cs                  # Bulk send with merge fields
│   ├── WithAttachments.cs            # Emails with files
│   ├── WithCidAttachments.cs         # Inline images
│   ├── WithTemplate.cs               # Templates with merge values
│   ├── ScheduledSend.cs              # Delayed delivery (TimeOffset)
│   ├── PreventThreading.cs           # Prevent Gmail threading
│   ├── Contacts.cs                   # Contacts and lists
│   ├── Domains.cs                    # Domain verification
│   ├── EmailStatus.cs                # Delivery status by transaction id
│   ├── Webhooks.cs                   # Manage webhooks
│   ├── Inbound.cs                    # Manage inbound routes
│   ├── DoubleOptinSubscribe.cs       # Double opt-in: subscribe
│   ├── DoubleOptinWebhook.cs         # Double opt-in: click-based confirm server
│   ├── Suppressions.cs               # Unsubscribes, bounces, complaints
│   ├── EmailVerification.cs          # Verify an address
│   ├── Statistics.cs                 # Account statistics
│   └── SubAccounts.cs                # Sub-accounts (read-only by default)
├── MinimalApiApp/                    # ASP.NET Core Minimal API
│   ├── MinimalApiApp.csproj
│   └── Program.cs
├── MvcApp/                           # ASP.NET Core MVC controllers
│   ├── MvcApp.csproj
│   ├── Program.cs
│   ├── Ee.cs
│   └── Controllers/
│       ├── EmailsController.cs
│       ├── WebhooksController.cs
│       ├── DoubleOptinController.cs
│       └── HealthController.cs
├── dotnet-elasticemail-examples.csproj
├── appsettings.json
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email C# SDK](https://github.com/ElasticEmail/elasticemail-csharp)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
