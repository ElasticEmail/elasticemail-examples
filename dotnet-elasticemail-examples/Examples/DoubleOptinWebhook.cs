namespace ElasticEmailExamples;

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

        static string Sanitize(string? value) => (value ?? "").Replace("\r", "").Replace("\n", "");

        var builder = WebApplication.CreateBuilder();
        var app = builder.Build();

        // Signed webhooks (ELASTICEMAIL_WEBHOOK_SECRET set) are verified with HMAC-SHA256 and
        // usually arrive as POST + JSON; unsigned ones carry ?token=. GET is accepted too.
        app.MapMethods("/double-optin/webhook", new[] { "GET", "POST" }, async (HttpRequest request) =>
        {
            var ev = await Ee.ReadWebhookEventAsync(request);
            if (ev == null)
            {
                return Results.Json(new { error = "Invalid signature or token" }, statusCode: 401);
            }

            string Field(string key) => ev.GetValueOrDefault(key) ?? "";

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
