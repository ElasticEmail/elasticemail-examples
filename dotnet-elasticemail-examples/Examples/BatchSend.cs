namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class BatchSend
{
    public static async Task RunAsync()
    {
        var emailsApi = new EmailsApi(Ee.Config());

        // Bulk send: one API call, one personalized email per recipient.
        // Values from Recipients[].Fields replace {placeholders} in the body.
        // Up to 1000 recipients per request.
        var recipients = new List<EmailRecipient>
        {
            new EmailRecipient(Ee.To, new Dictionary<string, string> { ["firstname"] = "Ann", ["plan"] = "Pro" }),
            new EmailRecipient(Ee.To, new Dictionary<string, string> { ["firstname"] = "Ben", ["plan"] = "Starter" }),
            new EmailRecipient(Ee.To, new Dictionary<string, string> { ["firstname"] = "Cleo", ["plan"] = "Team" }),
        };

        try
        {
            var result = await emailsApi.EmailsPostAsync(new EmailMessageData(
                recipients: recipients,
                content: new EmailContent(
                    from: Ee.From,
                    subject: "Hi {firstname}, your {plan} plan is ready",
                    body: new List<BodyPart>
                    {
                        new BodyPart(BodyContentType.HTML,
                            "<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>"),
                        new BodyPart(BodyContentType.PlainText,
                            "Hi {firstname}! Your {plan} plan is now active."),
                    })));

            Console.WriteLine($"Bulk email queued for {recipients.Count} recipients.");
            Console.WriteLine($"Transaction ID: {result.TransactionID}");
            Console.WriteLine($"Check delivery with: dotnet run -- email-status {result.TransactionID}");
        }
        catch (ApiException e)
        {
            Ee.Fail("send bulk email", e);
        }
    }
}
