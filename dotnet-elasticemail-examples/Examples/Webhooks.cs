namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class Webhooks
{
    public static async Task RunAsync()
    {
        var webhookApi = new WebhookApi(Ee.Config());

        // Elastic Email does not sign webhook requests. The examples append a shared secret
        // as a query parameter and the receiving handler checks it.
        var webhookUrl = $"{Ee.PublicUrl}/webhook?token={Uri.EscapeDataString(Ee.WebhookToken)}";

        // 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
        //    and answer 2xx (use a tunnel such as ngrok for local development).
        string? webhookId = null;
        try
        {
            var created = await webhookApi.WebhookPostAsync(new WebhookCreatePayload(
                name: "examples-webhook",
                uRL: webhookUrl,
                notifyOncePerEmail: false,
                notificationForSent: true,
                notificationForOpened: true,
                notificationForClicked: true,
                notificationForUnsubscribed: true,
                notificationForAbuseReport: true,
                notificationForError: true));
            webhookId = created.WebhookID;
            Console.WriteLine($"Webhook created: {webhookId} {created.URL}");
        }
        catch (ApiException e)
        {
            Ee.Fail("create webhook", e);
        }

        // 2. List
        try
        {
            var webhooks = await webhookApi.WebhookGetAsync(50, 0);
            Console.WriteLine($"\nWebhooks ({webhooks.Count}):");
            foreach (var w in webhooks)
            {
                Console.WriteLine($" - {w.WebhookID} {w.Name} {w.URL} enabled={w.IsEnabled}");
            }
        }
        catch (ApiException e)
        {
            Ee.Fail("list webhooks", e);
        }

        // 3. Delete the one we created (comment out to keep it)
        if (webhookId != null)
        {
            try
            {
                await webhookApi.WebhookByPublicidDeleteAsync(webhookId);
                Console.WriteLine($"\nWebhook deleted: {webhookId}");
            }
            catch (ApiException e)
            {
                Ee.Fail("delete webhook", e);
            }
        }
    }
}
