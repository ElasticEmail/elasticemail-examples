namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class Webhooks
{
    public static async Task RunAsync()
    {
        var webhookApi = new WebhookApi(Ee.Config());

        // Signed webhook: Elastic Email adds X-ElasticEmail-Timestamp and X-ElasticEmail-Signature
        // (HMAC-SHA256) headers and POSTs each event as JSON. The receiving handler verifies the
        // signature with ELASTICEMAIL_WEBHOOK_SECRET, so the URL needs no ?token=.
        // Signing and delivery method are chosen at creation and can't be changed later.
        var webhookUrl = $"{Ee.PublicUrl}/webhook";

        // 1. Create. Elastic Email sends a test event to the URL on save, so the handler must be
        //    reachable (use a tunnel such as ngrok for local development). The handler doesn't know
        //    the secret yet and answers 401, which Elastic Email accepts for signed webhooks.
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
                notificationForError: true,
                enableSigning: true,
                deliveryMethod: WebhookDeliveryMethod.PostJson));
            webhookId = created.WebhookID;
            Console.WriteLine($"Webhook created: {webhookId} {created.URL}");
            // Returned only in this response: store it as ELASTICEMAIL_WEBHOOK_SECRET
            Console.WriteLine($"Signing secret (shown once, store as ELASTICEMAIL_WEBHOOK_SECRET): {created.SigningSecret}");
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

        // 3. Rotate the signing secret. The old secret stops working immediately (no grace period).
        if (webhookId != null)
        {
            try
            {
                var rotated = await webhookApi.WebhookByPublicidSecretRotatePostAsync(webhookId);
                Console.WriteLine($"\nNew signing secret (store as ELASTICEMAIL_WEBHOOK_SECRET): {rotated.SigningSecret}");
            }
            catch (ApiException e)
            {
                Ee.Fail("rotate webhook secret", e);
            }
        }

        // 4. Delete the one we created (comment out to keep it)
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
