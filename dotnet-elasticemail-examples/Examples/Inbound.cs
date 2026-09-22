namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class Inbound
{
    public static async Task RunAsync()
    {
        var inboundApi = new InboundRouteApi(Ee.Config());
        var domain = Ee.SendingDomain;

        // Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
        // Matching emails are parsed and POSTed as form fields to HttpAddress
        // (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
        // See MinimalApiApp/Program.cs for the receiving handler.

        string? routeId = null;
        try
        {
            var route = await inboundApi.InboundroutePostAsync(new InboundPayload(
                name: "examples-inbound",
                filter: $"*@{domain}",
                filterType: InboundRouteFilterType.EmailAddress,
                actionType: InboundRouteActionType.NotifyViaHttp,
                httpAddress: $"{Ee.PublicUrl}/inbound?token={Uri.EscapeDataString(Ee.WebhookToken)}"));
            routeId = route.PublicId;
            Console.WriteLine($"Inbound route created: {routeId} {route.Filter} -> {route.ActionParameter}");
        }
        catch (ApiException e)
        {
            Ee.Fail("create route", e);
        }

        try
        {
            var routes = await inboundApi.InboundrouteGetAsync();
            Console.WriteLine($"\nInbound routes ({routes.Count}):");
            foreach (var r in routes)
            {
                Console.WriteLine($" - [{r.SortOrder}] {r.PublicId} {r.Name}: {r.FilterType}={r.Filter} {r.ActionType} {r.ActionParameter}");
            }
        }
        catch (ApiException e)
        {
            Ee.Fail("list routes", e);
        }

        // Delete the route we created (comment out to keep it)
        if (routeId != null)
        {
            try
            {
                await inboundApi.InboundrouteByIdDeleteAsync(routeId);
                Console.WriteLine($"\nInbound route deleted: {routeId}");
            }
            catch (ApiException e)
            {
                Ee.Fail("delete route", e);
            }
        }
    }
}
