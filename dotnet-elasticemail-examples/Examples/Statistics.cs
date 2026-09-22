namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;

public static class Statistics
{
    public static async Task RunAsync()
    {
        var statisticsApi = new StatisticsApi(Ee.Config());

        // Account-wide sending statistics for the last 30 days.
        // The API expects ISO 8601 dates without timezone, interpreted as UTC.
        var to = DateTime.UtcNow;
        var from = to.AddDays(-30);

        try
        {
            var data = await statisticsApi.StatisticsGetAsync(from, to);

            Console.WriteLine($"=== Statistics {from:yyyy-MM-ddTHH:mm:ss} to {to:yyyy-MM-ddTHH:mm:ss} ===");
            Console.WriteLine($"Recipients:    {data.Recipients}");
            Console.WriteLine($"Emails total:  {data.EmailTotal}");
            Console.WriteLine($"Delivered:     {data.Delivered}");
            Console.WriteLine($"Bounced:       {data.Bounced}");
            Console.WriteLine($"In progress:   {data.InProgress}");
            Console.WriteLine($"Opened:        {data.Opened}");
            Console.WriteLine($"Clicked:       {data.Clicked}");
            Console.WriteLine($"Unsubscribed:  {data.Unsubscribed}");
            Console.WriteLine($"Complaints:    {data.Complaints}");
        }
        catch (ApiException e)
        {
            Ee.Fail("fetch statistics", e);
        }
    }
}
