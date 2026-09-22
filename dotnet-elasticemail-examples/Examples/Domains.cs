namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;
using Newtonsoft.Json;

public static class Domains
{
    public static async Task RunAsync()
    {
        var domainsApi = new DomainsApi(Ee.Config());
        var domain = Ee.SendingDomain;

        // 1. Add the domain
        try
        {
            await domainsApi.DomainsPostAsync(new DomainPayload(domain: domain));
            Console.WriteLine($"Domain \"{domain}\" added.");
        }
        catch (ApiException e) when (e.ErrorCode == 400
            && (Ee.ErrorMessage(e).Contains("exist", StringComparison.OrdinalIgnoreCase)
                || Ee.ErrorMessage(e).Contains("already", StringComparison.OrdinalIgnoreCase)))
        {
            Console.WriteLine($"Domain \"{domain}\" already exists.");
        }
        catch (ApiException e)
        {
            Ee.Fail("add domain", e);
        }

        // 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
        try
        {
            var data = await domainsApi.DomainsByDomainGetAsync(domain);
            Console.WriteLine("\nVerification status:");
            Console.WriteLine($"  SPF:       {(data.Spf ? "ok" : "missing")}");
            Console.WriteLine($"  DKIM:      {(data.Dkim ? "ok" : "missing")}");
            Console.WriteLine($"  MX:        {(data.MX ? "ok" : "missing")}");
            Console.WriteLine($"  DMARC:     {(data.DMARC ? "ok" : "missing")}");
            Console.WriteLine($"  Tracking:  {data.TrackingStatus?.ToString() ?? "n/a"}");
            Console.WriteLine($"  Default:   {(data.DefaultDomain ? "yes" : "no")}");
            if (data.DKIMRecord != null)
            {
                Console.WriteLine($"\nDKIM record to publish: {JsonConvert.SerializeObject(data.DKIMRecord)}");
            }
        }
        catch (ApiException e)
        {
            Ee.Fail("get domain", e);
        }

        // 3. List all domains
        try
        {
            var domains = await domainsApi.DomainsGetAsync();
            Console.WriteLine($"\nDomains on the account ({domains.Count}):");
            foreach (var d in domains)
            {
                Console.WriteLine($" - {d.Domain} spf={d.Spf} dkim={d.Dkim} default={d.DefaultDomain}");
            }
        }
        catch (ApiException e)
        {
            Ee.Fail("list domains", e);
        }

        // 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
        // await domainsApi.DomainsByDomainVerificationPutAsync(domain, "Http");

        // 5. Optional: set the default sender for the account
        // await domainsApi.DomainsByEmailDefaultPatchAsync($"hello@{domain}");

        Console.WriteLine("\nDone.");
    }
}
