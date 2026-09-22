# Send your first email with .NET

Five minutes from a clean clone to a delivered email, using the Elastic Email C# SDK. Works as a
console app, with ASP.NET Minimal APIs or with ASP.NET MVC.

## Prerequisites

- .NET 8.0 SDK
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/dotnet-elasticemail-examples

dotnet restore
cp .env.example .env
```

In a project of your own:

```bash
dotnet add package ElasticEmail
dotnet add package DotNetEnv
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

`DotNetEnv.Env.TraversePath().Load()` walks up the directory tree, so one `.env` at the root serves
the console examples, `MinimalApiApp` and `MvcApp`. Full list in
[docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

```csharp
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

DotNetEnv.Env.TraversePath().Load();

var config = new Configuration();
config.AddApiKey("X-ElasticEmail-ApiKey", Environment.GetEnvironmentVariable("ELASTICEMAIL_API_KEY"));

var emailsApi = new EmailsApi(config);

try
{
    var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
        recipients: new TransactionalRecipient(
            to: new List<string> { Environment.GetEnvironmentVariable("EMAIL_TO")! }),
        content: new EmailContent(
            from: Environment.GetEnvironmentVariable("EMAIL_FROM"),
            subject: "Hello from Elastic Email!",
            body: new List<BodyPart>
            {
                new BodyPart(BodyContentType.HTML, "<h1>Welcome!</h1>"),
                new BodyPart(BodyContentType.PlainText, "Welcome!"),
            })));

    Console.WriteLine($"Transaction ID: {result.TransactionID}");
}
catch (ApiException e)
{
    Console.Error.WriteLine($"{e.ErrorCode} {e.ErrorContent}");   // {"Error": "..."}
}
```

Every method has an `Async` suffix, models use named constructor arguments in camelCase, and body
content types are the `BodyContentType` enum.

Run the version in this repository:

```bash
dotnet run -- basic-send
```

`Program.cs` is a dispatcher - `dotnet run` with no arguments lists all 18 examples.
`Examples/Ee.cs` holds the shared setup: `Config()`, `From`, `To`, `ErrorMessage()` and `Fail()`.

## 6. Or run a web app

```bash
cd MinimalApiApp && dotnet run     # http://localhost:3000
cd MvcApp && dotnet run            # http://localhost:3001
```

Both read `PORT` and `ASPNETCORE_URLS`.

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from .NET!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## Handling failures

`ApiException.ErrorContent` holds the raw body. `Ee.ErrorMessage(e)` parses the `Error` property out
of it and falls back to the raw body when it is not JSON. See
[Error handling](../docs/error-handling.md).

## Next steps

```bash
dotnet run -- batch-send             # one call, personalized per recipient
dotnet run -- with-attachments       # base64 file attachment
dotnet run -- with-cid-attachments   # inline image via cid:
dotnet run -- with-template          # hosted template + merge values
dotnet run -- webhooks               # create, list, delete a webhook
dotnet run -- email-status <transactionId>
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every example and route | [README.md](README.md) |
