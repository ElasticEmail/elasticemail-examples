namespace ElasticEmailExamples;

using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ElasticEmail.Client;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

/// <summary>
/// Shared setup for the standalone examples: .env loading, API configuration,
/// env helpers, webhook verification and API error printing.
/// </summary>
public static class Ee
{
    static Ee()
    {
        DotNetEnv.Env.TraversePath().Load();
    }

    public static string Env(string name, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrEmpty(value) ? fallback : value;
    }

    public static string From => Env("EMAIL_FROM", "Acme <hello@yourdomain.com>");
    public static string To => Env("EMAIL_TO", "you@yourdomain.com");
    public static string ListName => Env("ELASTICEMAIL_LIST_NAME", "Newsletter");
    public static string PublicUrl => Env("PUBLIC_URL", "http://localhost:3000");
    public static string WebhookToken => Env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");
    public static string SendingDomain => Env("SENDING_DOMAIN", "yourdomain.com");

    /// <summary>Signing secret returned once when the webhook is created with EnableSigning (null when unset).</summary>
    public static string? WebhookSecret =>
        Environment.GetEnvironmentVariable("ELASTICEMAIL_WEBHOOK_SECRET") is { Length: > 0 } s ? s : null;

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
        var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var secret = WebhookSecret;

        if (secret == null)
        {
            var given = Encoding.UTF8.GetBytes(request.Query["token"].ToString());
            if (!CryptographicOperations.FixedTimeEquals(given, Encoding.UTF8.GetBytes(WebhookToken)))
            {
                return null;
            }
            foreach (var (key, value) in request.Query)
            {
                fields[key] = value.ToString();
            }
            if (request.HasFormContentType)
            {
                foreach (var (key, value) in await request.ReadFormAsync())
                {
                    fields[key] = value.ToString();
                }
            }
            return fields;
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

    public static Configuration Config()
    {
        var apiKey = Environment.GetEnvironmentVariable("ELASTICEMAIL_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
        {
            throw new Exception("ELASTICEMAIL_API_KEY environment variable is required");
        }

        var config = new Configuration();
        config.AddApiKey("X-ElasticEmail-ApiKey", apiKey);
        return config;
    }

    /// <summary>
    /// The API answers errors with {"Error": "message"}. ErrorContent holds the raw body.
    /// </summary>
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
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("Error", out var error))
            {
                return error.GetString() ?? raw;
            }
        }
        catch (JsonException)
        {
        }

        return raw;
    }

    public static void PrintApiError(string step, ApiException e)
    {
        Console.Error.WriteLine($"Error ({step}): {e.ErrorCode} {ErrorMessage(e)}");
    }

    public static void Fail(string step, ApiException e)
    {
        PrintApiError(step, e);
        Environment.Exit(1);
    }
}
