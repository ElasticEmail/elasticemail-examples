namespace ElasticEmailExamples;

using System.Security.Cryptography;
using System.Text;
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see Webhooks.cs) pointing at POST /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.
public static class DoubleOptinWebhook
{
    public static async Task RunAsync()
    {
        var listsApi = new ListsApi(Ee.Config());
        var listName = Ee.ListName;
        var expectedToken = Encoding.UTF8.GetBytes(Ee.WebhookToken);

        bool TokenOk(string? token)
        {
            var given = Encoding.UTF8.GetBytes(token ?? "");
            return CryptographicOperations.FixedTimeEquals(given, expectedToken);
        }

        static string Sanitize(string? value) => (value ?? "").Replace("\r", "").Replace("\n", "");

        var builder = WebApplication.CreateBuilder();
        var app = builder.Build();

        // Elastic Email validates the URL with a GET when the webhook is saved.
        app.MapGet("/double-optin/webhook", (HttpRequest request) =>
        {
            if (!TokenOk(request.Query["token"]))
            {
                return Results.Json(new { error = "Invalid token" }, statusCode: 401);
            }
            return Results.Json(new { ok = true });
        });

        app.MapPost("/double-optin/webhook", async (HttpRequest request) =>
        {
            if (!TokenOk(request.Query["token"]))
            {
                return Results.Json(new { error = "Invalid token" }, statusCode: 401);
            }

            var form = request.HasFormContentType ? await request.ReadFormAsync() : null;
            string Field(string key) => form != null && form.TryGetValue(key, out var v) ? v.ToString() : request.Query[key].ToString();

            var status = Sanitize(Field("status"));
            var target = Sanitize(Field("target"));
            var recipient = Sanitize(Field("to"));

            if (status != "Clicked" || !target.Contains("/double-optin/confirm"))
            {
                return Results.Json(new { received = true, status, message = "Event ignored" });
            }

            try
            {
                await listsApi.ListsByNameContactsPostAsync(listName, new EmailsPayload(emails: new List<string> { recipient }));
                Console.WriteLine($"Subscription confirmed via click: {recipient}");
                return Results.Json(new { received = true, confirmed = true, email = recipient, list = listName });
            }
            catch (ApiException e)
            {
                Ee.PrintApiError("add contact to list", e);
                return Results.Json(new { error = Ee.ErrorMessage(e) }, statusCode: 500);
            }
        });

        var port = Ee.Env("PORT", "3000");
        Console.WriteLine($"Double opt-in webhook listening on http://localhost:{port}/double-optin/webhook");
        await app.RunAsync($"http://localhost:{port}");
    }
}
