namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;

public static class EmailVerification
{
    // Usage: dotnet run -- email-verification someone@example.com
    public static async Task RunAsync(string[] args)
    {
        var verificationsApi = new VerificationsApi(Ee.Config());
        var email = args.Length > 0 ? args[0] : Ee.To;

        // Email verification is a paid feature. Accounts without it get a 4xx here.
        try
        {
            await verificationsApi.VerificationsByEmailPostAsync(email);
            var data = await verificationsApi.VerificationsByEmailGetAsync(email);

            Console.WriteLine("=== Verification result ===");
            Console.WriteLine($"Email:       {data.Email}");
            Console.WriteLine($"Result:      {data.Result}");
            Console.WriteLine($"Reason:      {data.Reason}");
            Console.WriteLine($"Disposable:  {data.Disposable}");
            Console.WriteLine($"Role:        {data.Role}");
            if (!string.IsNullOrEmpty(data.SuggestedSpelling))
            {
                Console.WriteLine($"Did you mean: {data.SuggestedSpelling}");
            }
        }
        catch (ApiException e)
        {
            Ee.Fail("verify email", e);
        }
    }
}
