namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;

public static class Suppressions
{
    // Usage: dotnet run -- suppressions [email]
    public static async Task RunAsync(string[] args)
    {
        var suppressionsApi = new SuppressionsApi(Ee.Config());
        var email = args.Length > 0 ? args[0] : "suppressed@example.com";

        // Suppressions are split into unsubscribes, bounces and complaints.
        // Adding to any list stops future sends to that address.
        try
        {
            await suppressionsApi.SuppressionsUnsubscribesPostAsync(new List<string> { email });
            Console.WriteLine($"Added to unsubscribes: {email}");
        }
        catch (ApiException e)
        {
            Ee.Fail("add unsubscribe", e);
        }

        try
        {
            var s = await suppressionsApi.SuppressionsByEmailGetAsync(email);
            Console.WriteLine($"Suppression: Email={s.Email} Reason={s.FriendlyErrorMessage} DateUpdated={s.DateUpdated:O}");
        }
        catch (ApiException e)
        {
            Ee.Fail("get suppression", e);
        }

        try
        {
            var all = await suppressionsApi.SuppressionsGetAsync(10, 0);
            Console.WriteLine($"\nAll suppressions (first {all.Count}):");
            foreach (var s in all)
            {
                Console.WriteLine($" - {s.Email} {s.FriendlyErrorMessage}");
            }
        }
        catch (ApiException e)
        {
            Ee.Fail("list suppressions", e);
        }

        // Remove it again so the address can receive email
        try
        {
            await suppressionsApi.SuppressionsByEmailDeleteAsync(email);
            Console.WriteLine($"\nRemoved from suppressions: {email}");
        }
        catch (ApiException e)
        {
            Ee.Fail("delete suppression", e);
        }
    }
}
