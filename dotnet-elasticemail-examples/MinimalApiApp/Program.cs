using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;
using Microsoft.AspNetCore.Http.Features;

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
// Signing secret returned once when the webhook is created with EnableSigning (null when unset)
var webhookSecret = Environment.GetEnvironmentVariable("ELASTICEMAIL_WEBHOOK_SECRET") is { Length: > 0 } ws ? ws : null;
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

// Verifies an Elastic Email webhook signature: lowercase hex HMAC-SHA256 of
// "{timestamp}\n{METHOD}\n{request target}\n{raw body}" keyed with the signing secret.
// The header may carry several comma-separated "v1=" entries; any match is accepted.
static bool VerifySignature(string signingSecret, string? timestamp, string? signatureHeader,
    string method, string target, byte[] body, long? now = null)
{
    if (string.IsNullOrEmpty(signatureHeader)
        || !long.TryParse(timestamp, NumberStyles.None, CultureInfo.InvariantCulture, out var ts)
        || Math.Abs((now ?? DateTimeOffset.UtcNow.ToUnixTimeSeconds()) - ts) > 300)
    {
        return false;
    }

    var message = Encoding.UTF8.GetBytes($"{timestamp}\n{method}\n{target}\n").Concat(body).ToArray();
    var expected = Encoding.ASCII.GetBytes(Convert.ToHexString(
        HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingSecret), message)).ToLowerInvariant());

    var ok = false;
    foreach (var entry in signatureHeader.Split(','))
    {
        var value = entry.Trim();
        if (value.StartsWith("v1=", StringComparison.Ordinal)
            && CryptographicOperations.FixedTimeEquals(expected, Encoding.ASCII.GetBytes(value[3..])))
        {
            ok = true;
        }
    }
    return ok;
}

// Reads a webhook event. With ELASTICEMAIL_WEBHOOK_SECRET set the request must carry a valid
// signature and the event comes from the JSON body (POST) or the query string (GET).
// Without it, the ?token= shared secret is checked and query/form fields are merged.
// Returns null when the request is not authentic.
async Task<Dictionary<string, string>?> ReadWebhookEventAsync(HttpRequest request)
{
    if (webhookSecret == null)
    {
        return TokenOk(request.Query["token"]) ? await ReadEventAsync(request) : null;
    }

    // Raw body bytes and the request target exactly as received (still URL-encoded)
    using var buffer = new MemoryStream();
    await request.Body.CopyToAsync(buffer);
    var body = buffer.ToArray();
    var target = request.HttpContext.Features.Get<IHttpRequestFeature>()?.RawTarget
        ?? $"{request.PathBase}{request.Path}{request.QueryString}";

    if (!VerifySignature(webhookSecret, request.Headers["X-ElasticEmail-Timestamp"].ToString(),
            request.Headers["X-ElasticEmail-Signature"].ToString(), request.Method, target, body))
    {
        return null;
    }

    var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    if (HttpMethods.IsGet(request.Method))
    {
        foreach (var (key, value) in request.Query)
        {
            fields[key] = value.ToString();
        }
    }
    else if (body.Length > 0)
    {
        // PostJson: a flat JSON object with the same field names as the GET parameters
        using var doc = JsonDocument.Parse(body);
        if (doc.RootElement.ValueKind != JsonValueKind.Object)
        {
            return fields;
        }
        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.String)
            {
                fields[prop.Name] = prop.Value.GetString() ?? "";
            }
            else if (prop.Value.ValueKind != JsonValueKind.Null)
            {
                fields[prop.Name] = prop.Value.GetRawText();
            }
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

    // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new one.
    string? idempotencyKey = request.Headers["Idempotency-Key"];
    if (string.IsNullOrEmpty(idempotencyKey))
    {
        idempotencyKey = Guid.NewGuid().ToString();
    }

    try
    {
        var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
            recipients: new TransactionalRecipient(to: new List<string> { to }),
            content: new EmailContent(
                from: from,
                subject: subject,
                body: new List<BodyPart> { new BodyPart(BodyContentType.HTML, $"<p>{message}</p>") })),
            idempotencyKey: idempotencyKey);
        // null means no response from Elastic Email (network error, timeout): safe to retry with the same key.
        if (result == null)
        {
            return Results.Json(new { error = "No response from Elastic Email" }, statusCode: 502);
        }
        return Results.Json(new { success = true, transactionId = result.TransactionID, messageId = result.MessageID });
    }
    catch (ApiException e)
    {
        return ApiError(e);
    }
});

// Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
// category, channel, target (clicked URL), ip, useragent, country, city.
// Signed webhooks (recommended, ELASTICEMAIL_WEBHOOK_SECRET set) are verified with HMAC-SHA256
// and usually arrive as POST with a JSON body. Unsigned webhooks carry ?token= and send the
// fields in the query string (GET) or as form fields (POST).
// Elastic Email sends a test event when the webhook is saved.
app.MapMethods("/webhook", new[] { "GET", "POST" }, async (HttpRequest request) =>
{
    var ev = await ReadWebhookEventAsync(request);
    if (ev == null)
    {
        return Results.Json(new { error = "Invalid signature or token" }, statusCode: 401);
    }

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
// Verified like /webhook: signature when ELASTICEMAIL_WEBHOOK_SECRET is set, else ?token=.
app.MapMethods("/double-optin/webhook", new[] { "GET", "POST" }, async (HttpRequest request) =>
{
    var ev = await ReadWebhookEventAsync(request);
    if (ev == null)
    {
        return Results.Json(new { error = "Invalid signature or token" }, statusCode: 401);
    }

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
