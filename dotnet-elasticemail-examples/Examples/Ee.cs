namespace ElasticEmailExamples;

using System.Text.Json;
using ElasticEmail.Client;

/// <summary>
/// Shared setup for the standalone examples: .env loading, API configuration,
/// env helpers and API error printing.
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
