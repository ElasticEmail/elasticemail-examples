using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ElasticEmail.Client;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;

namespace MvcApp;

/// <summary>
/// Shared helpers for the controllers: env values, webhook signature/token check, HMAC, API error mapping.
/// </summary>
public static class Ee
{
    public static string Env(string name, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrEmpty(value) ? fallback : value;
    }

    public static string From => Env("EMAIL_FROM", "Acme <hello@yourdomain.com>");
    public static string ContactEmail => Env("CONTACT_EMAIL", From);
    public static string ListName => Env("ELASTICEMAIL_LIST_NAME", "Newsletter");
    public static string PublicUrl => Env("PUBLIC_URL", "http://localhost:3000");
    public static string Secret => Env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");

    /// <summary>Signing secret returned once when the webhook is created with EnableSigning (null when unset).</summary>
    public static string? WebhookSecret =>
        Environment.GetEnvironmentVariable("ELASTICEMAIL_WEBHOOK_SECRET") is { Length: > 0 } s ? s : null;

    /// <summary>Strip newlines from user-controlled values before logging.</summary>
    public static string Sanitize(string? value) => (value ?? "").Replace("\r", "").Replace("\n", "");

    /// <summary>Constant-time comparison of the shared secret carried in ?token=.</summary>
    public static bool TokenOk(string? token) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(token ?? ""), Encoding.UTF8.GetBytes(Secret));

    public static string Hmac(string value) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(Secret), Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    /// <summary>Merge query string and form fields. Elastic Email uses GET (query) or POST (form-encoded).</summary>
    public static async Task<Dictionary<string, string>> ReadEventAsync(HttpRequest request)
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

    /// <summary>
    /// Verifies an Elastic Email webhook signature: lowercase hex HMAC-SHA256 of
    /// "{timestamp}\n{METHOD}\n{request target}\n{raw body}" keyed with the signing secret.
    /// The header may carry several comma-separated "v1=" entries; any match is accepted.
    /// </summary>
    public static bool VerifySignature(string secret, string? timestamp, string? signatureHeader,
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
            HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), message)).ToLowerInvariant());

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

    /// <summary>
    /// Reads a webhook event. With ELASTICEMAIL_WEBHOOK_SECRET set the request must carry a valid
    /// signature and the event comes from the JSON body (POST) or the query string (GET).
    /// Without it, the ?token= shared secret is checked and query/form fields are merged.
    /// Returns null when the request is not authentic.
    /// </summary>
    public static async Task<Dictionary<string, string>?> ReadWebhookEventAsync(HttpRequest request)
    {
        var secret = WebhookSecret;
        if (secret == null)
        {
            return TokenOk(request.Query["token"]) ? await ReadEventAsync(request) : null;
        }

        // Raw body bytes and the request target exactly as received (still URL-encoded)
        using var buffer = new MemoryStream();
        await request.Body.CopyToAsync(buffer);
        var body = buffer.ToArray();
        var target = request.HttpContext.Features.Get<IHttpRequestFeature>()?.RawTarget
            ?? $"{request.PathBase}{request.Path}{request.QueryString}";

        if (!VerifySignature(secret, request.Headers["X-ElasticEmail-Timestamp"].ToString(),
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

    /// <summary>The API answers errors with {"Error": "message"}. ErrorContent holds the raw body.</summary>
    public static string ErrorMessage(ApiException e)
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

    public static IActionResult ApiError(ApiException e) =>
        new ObjectResult(new { error = ErrorMessage(e) }) { StatusCode = e.ErrorCode >= 400 ? e.ErrorCode : 500 };
}
