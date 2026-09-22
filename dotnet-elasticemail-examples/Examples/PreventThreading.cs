namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class PreventThreading
{
    public static async Task RunAsync()
    {
        var emailsApi = new EmailsApi(Ee.Config());

        // Gmail groups emails into threads based on subject and Message-ID/References headers.
        // A unique X-Entity-Ref-ID header per email prevents this grouping.
        for (var i = 1; i <= 3; i++)
        {
            try
            {
                var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                    recipients: new TransactionalRecipient(to: new List<string> { Ee.To }),
                    content: new EmailContent(
                        from: Ee.From,
                        subject: "Order Confirmation", // Same subject for all
                        body: new List<BodyPart>
                        {
                            new BodyPart(BodyContentType.HTML,
                                $"<h1>Order Confirmation</h1><p>This is email #{i}. Each appears as a separate conversation in Gmail.</p>"),
                        },
                        headers: new Dictionary<string, string>
                        {
                            ["X-Entity-Ref-ID"] = Guid.NewGuid().ToString(),
                        })));

                Console.WriteLine($"Email #{i} sent: {result.MessageID}");
            }
            catch (ApiException e)
            {
                Ee.Fail($"send email #{i}", e);
            }
        }

        Console.WriteLine("\nAll emails sent with unique X-Entity-Ref-ID headers.");
    }
}
