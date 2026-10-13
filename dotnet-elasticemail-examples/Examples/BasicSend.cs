namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class BasicSend
{
    public static async Task RunAsync()
    {
        var emailsApi = new EmailsApi(Ee.Config());

        // Reuse this key only to retry this same send.
        var idempotencyKey = Guid.NewGuid().ToString();

        try
        {
            var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { Ee.To }),
                content: new EmailContent(
                    from: Ee.From,
                    subject: "Hello from Elastic Email!",
                    body: new List<BodyPart>
                    {
                        new BodyPart(BodyContentType.HTML,
                            "<h1>Welcome!</h1><p>This email was sent using the Elastic Email C# SDK.</p>"),
                        new BodyPart(BodyContentType.PlainText,
                            "Welcome! This email was sent using the Elastic Email C# SDK."),
                    })), idempotencyKey: idempotencyKey);

            // The SDK returns null instead of throwing when no response arrived (network error, timeout).
            if (result == null)
            {
                Console.Error.WriteLine($"Error (send email): no response; retry with idempotency key {idempotencyKey}");
                Environment.Exit(1);
            }

            Console.WriteLine("Email sent successfully!");
            Console.WriteLine($"Transaction ID: {result.TransactionID}");
            Console.WriteLine($"Message ID: {result.MessageID}");
            Console.WriteLine($"Idempotency key: {idempotencyKey}");
        }
        catch (ApiException e)
        {
            Ee.Fail("send email", e);
        }
    }
}
