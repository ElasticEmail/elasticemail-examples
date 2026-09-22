using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

DotNetEnv.Env.TraversePath().Load();

string Env(string name, string fallback)
{
    var value = Environment.GetEnvironmentVariable(name);
    return string.IsNullOrEmpty(value) ? fallback : value;
}

var apiKey = Environment.GetEnvironmentVariable("ELASTICEMAIL_API_KEY");
if (string.IsNullOrEmpty(apiKey))
{
    throw new Exception("ELASTICEMAIL_API_KEY environment variable is required");
}

var config = new Configuration();
config.AddApiKey("X-ElasticEmail-ApiKey", apiKey);
var emailsApi = new EmailsApi(config);
var contactsApi = new ContactsApi(config);
var listsApi = new ListsApi(config);

var from = Env("EMAIL_FROM", "Acme <hello@yourdomain.com>");
var contactEmail = Env("CONTACT_EMAIL", from);
var listName = Env("ELASTICEMAIL_LIST_NAME", "Newsletter");
var publicUrl = Env("PUBLIC_URL", "http://localhost:3000");
var secret = Env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");
var confirmRedirectUrl = Environment.GetEnvironmentVariable("CONFIRM_REDIRECT_URL");

// Strip newlines from user-controlled values before logging
static string Sanitize(string? value) => (value ?? "").Replace("\r", "").Replace("\n", "");

// Constant-time comparison of the shared secret carried in ?token=
bool TokenOk(string? token) =>
    CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(token ?? ""), Encoding.UTF8.GetBytes(secret));

string Hmac(string value) =>
    Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

// The API answers errors with {"Error": "message"}. ErrorContent holds the raw body.
static string ApiErrorMessage(ApiException e)
{
    var raw = e.ErrorContent?.ToString();
    if (string.IsNullOrEmpty(raw))
    {
        return e.Message;
    }
    try
    {
        using var doc = JsonDocument.Parse(raw);
        if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("Error", out var error))
        {
            return error.GetString() ?? raw;
        }
    }
    catch (JsonException)
    {
    }
    return raw;
}

static IResult ApiError(ApiException e) =>
    Results.Json(new { error = ApiErrorMessage(e) }, statusCode: e.ErrorCode >= 400 ? e.ErrorCode : 500);

// Elastic Email webhooks and inbound notifications are form-encoded (POST) or query string (GET).
static async Task<Dictionary<string, string>> ReadEventAsync(HttpRequest request)
{
    var fields = new Dictionary<string, string>(StringComparer.Ordinal);
    foreach (var (key, value) in request.Query)
    {
        fields[key] = value.ToString();
    }
    if (request.HasFormContentType)
    {
        var form = await request.ReadFormAsync();
        foreach (var (key, value) in form)
        {
            fields[key] = value.ToString();
        }
    }
    return fields;
}

static string? Json(JsonElement body, string name) =>
    body.ValueKind == JsonValueKind.Object && body.TryGetProperty(name, out var prop) && prop.ValueKind == JsonValueKind.String
        ? prop.GetString()
        : null;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
{
    // Inbound emails carry base64 attachments in form fields
    o.ValueLengthLimit = 25 * 1024 * 1024;
    o.MultipartBodyLengthLimit = 25 * 1024 * 1024;
});
var app = builder.Build();

app.MapGet("/health", () => Results.Json(new { status = "ok" }));

app.MapPost("/send", async (HttpRequest request) =>
{
    var body = await request.ReadFromJsonAsync<JsonElement>();
    var to = Json(body, "to");
    var subject = Json(body, "subject");
    var message = Json(body, "message");

    if (string.IsNullOrEmpty(to) || string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(message))
    {
        return Results.BadRequest(new { error = "Missing required fields: to, subject, message" });
    }

    try
    {
        var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
            recipients: new TransactionalRecipient(to: new List<string> { to }),
            content: new EmailContent(
                from: from,
                subject: subject,
                body: new List<BodyPart> { new BodyPart(BodyContentType.HTML, $"<p>{message}</p>") })));
        return Results.Json(new { success = true, transactionId = result.TransactionID, messageId = result.MessageID });
    }
    catch (ApiException e)
    {
        return ApiError(e);
    }
});

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
app.MapMethods("/webhook", new[] { "GET", "POST" }, async (HttpRequest request) =>
{
    if (!TokenOk(request.Query["token"]))
    {
        return Results.Json(new { error = "Invalid token" }, statusCode: 401);
    }

    var ev = await ReadEventAsync(request);
    var status = Sanitize(ev.GetValueOrDefault("status"));

    if (status.Length == 0)
    {
        // Validation ping or empty request
        return Results.Json(new { ok = true });
    }

    Console.WriteLine($"Webhook event: {status} to: {Sanitize(ev.GetValueOrDefault("to"))} transaction: {Sanitize(ev.GetValueOrDefault("transaction"))}");

    switch (status)
    {
        case "Sent":
            Console.WriteLine($"Email sent, message id: {Sanitize(ev.GetValueOrDefault("messageid"))}");
            break;
        case "Opened":
            Console.WriteLine($"Email opened from {Sanitize(ev.GetValueOrDefault("Country"))} {Sanitize(ev.GetValueOrDefault("City"))}");
            break;
        case "Clicked":
            Console.WriteLine($"Link clicked: {Sanitize(ev.GetValueOrDefault("target"))}");
            break;
        case "Error":
            Console.WriteLine($"Bounce/error, category: {Sanitize(ev.GetValueOrDefault("category"))}");
            break;
        case "AbuseReport":
            Console.WriteLine("Complaint received");
            break;
        case "Unsubscribed":
            Console.WriteLine("Recipient unsubscribed");
            break;
    }

    return Results.Json(new { received = true, status });
});

// Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
app.MapPost("/inbound", async (HttpRequest request) =>
{
    if (!TokenOk(request.Query["token"]))
    {
        return Results.Json(new { error = "Invalid token" }, statusCode: 401);
    }

    var mail = await ReadEventAsync(request);
    var attachments = mail.Keys
        .Where(k => Regex.IsMatch(k, @"^att\d+_name$"))
        .Select(k => (Name: mail[k], Content: mail.GetValueOrDefault(k.Replace("_name", "_content"))))
        .ToList();

    Console.WriteLine($"Inbound email from: {Sanitize(mail.GetValueOrDefault("from_email"))} subject: {Sanitize(mail.GetValueOrDefault("subject"))}");
    Console.WriteLine($"Attachments: {(attachments.Count > 0 ? string.Join(", ", attachments.Select(a => a.Name)) : "none")}");

    // Forward a copy to the team inbox
    try
    {
        var bodyHtml = mail.GetValueOrDefault("body_html");
        if (string.IsNullOrEmpty(bodyHtml))
        {
            bodyHtml = $"<pre>{(mail.GetValueOrDefault("body_text") ?? "").Replace("<", "&lt;")}</pre>";
        }

        var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
            recipients: new TransactionalRecipient(to: new List<string> { contactEmail }),
            content: new EmailContent(
                from: from,
                replyTo: mail.GetValueOrDefault("from_email"),
                subject: $"Fwd: {mail.GetValueOrDefault("subject") ?? "(no subject)"}",
                body: new List<BodyPart> { new BodyPart(BodyContentType.HTML, bodyHtml) },
                attachments: attachments
                    .Where(a => !string.IsNullOrEmpty(a.Content))
                    .Select(a => new MessageAttachment(binaryContent: Convert.FromBase64String(a.Content!), name: a.Name))
                    .ToList())));
        return Results.Json(new { received = true, forwardedMessageId = result.MessageID });
    }
    catch (ApiException e)
    {
        return ApiError(e);
    }
});

app.MapPost("/double-optin/subscribe", async (HttpRequest request) =>
{
    var body = await request.ReadFromJsonAsync<JsonElement>();
    var email = Json(body, "email");
    var name = Json(body, "name") ?? "";

    if (string.IsNullOrEmpty(email))
    {
        return Results.BadRequest(new { error = "Missing required field: email" });
    }

    var confirmUrl = $"{publicUrl}/double-optin/confirm?email={Uri.EscapeDataString(email)}&token={Hmac(email)}";
    var greeting = string.IsNullOrEmpty(name) ? "Welcome!" : $"Welcome, {name}!";

    try
    {
        // Stored as Transactional so it receives the confirmation but no campaigns yet
        await contactsApi.ContactsPostAsync(new List<ContactPayload>
        {
            new ContactPayload(
                email: email,
                firstName: name.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "",
                status: ContactStatus.Transactional),
        });

        var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
            recipients: new TransactionalRecipient(to: new List<string> { email }),
            content: new EmailContent(
                from: from,
                subject: "Confirm your subscription",
                body: new List<BodyPart>
                {
                    new BodyPart(BodyContentType.HTML, $"""
                        <div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
                          <h1>{greeting}</h1>
                          <p>Please confirm your subscription to our newsletter.</p>
                          <a href="{confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
                        </div>
                        """),
                })));

        return Results.Json(new { success = true, message = "Confirmation email sent", messageId = result.MessageID });
    }
    catch (ApiException e)
    {
        return ApiError(e);
    }
});

app.MapGet("/double-optin/confirm", async (HttpRequest request) =>
{
    var email = request.Query["email"].ToString();
    var token = request.Query["token"].ToString();

    var expected = Encoding.UTF8.GetBytes(Hmac(email));
    var given = Encoding.UTF8.GetBytes(token);
    if (email.Length == 0 || !CryptographicOperations.FixedTimeEquals(expected, given))
    {
        return Results.BadRequest(new { error = "Invalid confirmation link" });
    }

    try
    {
        await listsApi.ListsByNameContactsPostAsync(listName, new EmailsPayload(emails: new List<string> { email }));
        if (!string.IsNullOrEmpty(confirmRedirectUrl))
        {
            return Results.Redirect(confirmRedirectUrl);
        }
        return Results.Json(new { confirmed = true, email, list = listName });
    }
    catch (ApiException e)
    {
        return ApiError(e);
    }
});

// Click-tracking based confirmation: create a webhook for Clicked events pointing here.
app.MapPost("/double-optin/webhook", async (HttpRequest request) =>
{
    if (!TokenOk(request.Query["token"]))
    {
        return Results.Json(new { error = "Invalid token" }, statusCode: 401);
    }

    var ev = await ReadEventAsync(request);
    var status = ev.GetValueOrDefault("status");
    var target = ev.GetValueOrDefault("target") ?? "";
    var to = ev.GetValueOrDefault("to") ?? "";

    if (status != "Clicked" || !target.Contains("/double-optin/confirm"))
    {
        return Results.Json(new { received = true, status = Sanitize(status), message = "Event ignored" });
    }

    try
    {
        await listsApi.ListsByNameContactsPostAsync(listName, new EmailsPayload(emails: new List<string> { to }));
        return Results.Json(new { received = true, confirmed = true, email = Sanitize(to) });
    }
    catch (ApiException e)
    {
        return ApiError(e);
    }
});

var port = Env("PORT", "3000");
var url = Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? $"http://localhost:{port}";
Console.WriteLine($"Minimal API server running on {url}");
app.Run(url);
