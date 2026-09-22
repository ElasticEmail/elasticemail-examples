namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;

public static class EmailStatus
{
    // Usage: dotnet run -- email-status <transactionId> [messageId]
    // Both ids are returned by every send call.
    public static async Task RunAsync(string[] args)
    {
        if (args.Length == 0)
        {
            Console.Error.WriteLine("Usage: dotnet run -- email-status <transactionId> [messageId]");
            Environment.Exit(1);
        }

        var transactionId = args[0];
        var messageId = args.Length > 1 ? args[1] : null;
        var emailsApi = new EmailsApi(Ee.Config());

        try
        {
            var data = await emailsApi.EmailsByTransactionidStatusGetAsync(
                transactionId,
                showFailed: true,
                showSent: true,
                showDelivered: true,
                showPending: true,
                showOpened: true,
                showClicked: true);

            Console.WriteLine("=== Transaction status ===");
            Console.WriteLine($"Status:      {data.Status}");
            Console.WriteLine($"Recipients:  {data.RecipientsCount}");
            Console.WriteLine($"Sent:        {data.SentCount} [{Join(data.Sent)}]");
            Console.WriteLine($"Delivered:   {data.DeliveredCount} [{Join(data.Delivered)}]");
            Console.WriteLine($"Pending:     {data.PendingCount}");
            Console.WriteLine($"Opened:      {data.OpenedCount}");
            Console.WriteLine($"Clicked:     {data.ClickedCount}");
            Console.WriteLine($"Failed:      {data.FailedCount} [{Join(data.Failed?.Select(f => f.Address))}]");
        }
        catch (ApiException e)
        {
            Ee.Fail("fetch status", e);
        }

        if (messageId == null)
        {
            return;
        }

        try
        {
            var data = await emailsApi.EmailsByMsgidViewGetAsync(messageId);
            Console.WriteLine("\n=== Message ===");
            Console.WriteLine($"From:     {data.Preview?.From}");
            Console.WriteLine($"Subject:  {data.Preview?.Subject}");
            Console.WriteLine($"Status:   {data.Status?.StatusName} {data.Status?.DateSent:O}");
            var body = data.Preview?.Body ?? "";
            Console.WriteLine($"Body preview: {(body.Length > 200 ? body[..200] + "..." : body)}");
        }
        catch (ApiException e)
        {
            Ee.PrintApiError("fetch message", e);
        }
    }

    private static string Join(IEnumerable<string>? values) => string.Join(", ", values ?? Enumerable.Empty<string>());
}
