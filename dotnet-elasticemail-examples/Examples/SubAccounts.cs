namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class SubAccounts
{
    public static async Task RunAsync()
    {
        var subAccountsApi = new SubAccountsApi(Ee.Config());

        // Sub-accounts let you isolate customers or projects with their own API keys and credits.
        // Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.
        var createEnabled = Ee.Env("CREATE_SUBACCOUNT", "false") == "true";
        var subEmail = Ee.Env("SUBACCOUNT_EMAIL", $"sub-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}@example.com");

        try
        {
            var accounts = await subAccountsApi.SubaccountsGetAsync(20, 0);
            Console.WriteLine($"Sub-accounts ({accounts.Count}):");
            foreach (var s in accounts)
            {
                Console.WriteLine($" - {s.Email} status={s.Status} credits={s.EmailCredits} sent={s.TotalEmailsSent}");
            }
        }
        catch (ApiException e)
        {
            Ee.Fail("list sub-accounts", e);
        }

        if (!createEnabled)
        {
            Console.WriteLine("\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.");
            return;
        }

        try
        {
            var created = await subAccountsApi.SubaccountsPostAsync(new SubaccountPayload(
                email: subEmail,
                password: $"Tmp-{Guid.NewGuid():N}-Aa1!",
                sendActivation: false));
            Console.WriteLine($"\nSub-account created: {created.Email}");

            await subAccountsApi.SubaccountsByEmailCreditsPatchAsync(subEmail,
                new SubaccountEmailCreditsPayload(credits: 1000, notes: "Initial allocation"));
            Console.WriteLine($"Assigned 1000 credits to {subEmail}");

            var key = await subAccountsApi.SubaccountsByEmailApikeyGetAsync(subEmail);
            Console.WriteLine($"Sub-account API key retrieved (length): {key.Length}");
        }
        catch (ApiException e)
        {
            Ee.Fail("create sub-account", e);
        }
    }
}
