namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class ScheduledSend
{
    public static async Task RunAsync()
    {
        var emailsApi = new EmailsApi(Ee.Config());

        // TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
        // Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
        const int delayMinutes = 60;
        var scheduledFor = DateTime.UtcNow.AddMinutes(delayMinutes);

        try
        {
            var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { Ee.To }),
                content: new EmailContent(
                    from: Ee.From,
                    subject: "Scheduled Email",
                    body: new List<BodyPart>
                    {
                        new BodyPart(BodyContentType.HTML,
                            $"<h1>Scheduled Email</h1><p>This email was scheduled for {scheduledFor:O}.</p>"),
                    }),
                options: new Options(timeOffset: delayMinutes)));

            Console.WriteLine($"Email scheduled for {scheduledFor:O}");
            Console.WriteLine($"Transaction ID: {result.TransactionID}");
            Console.WriteLine($"Message ID: {result.MessageID}");
        }
        catch (ApiException e)
        {
            Ee.Fail("schedule email", e);
        }
    }
}
