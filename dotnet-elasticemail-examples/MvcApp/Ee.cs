using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ElasticEmail.Client;
using Microsoft.AspNetCore.Mvc;

namespace MvcApp;

/// <summary>
/// Shared helpers for the controllers: env values, webhook token check, HMAC, API error mapping.
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
