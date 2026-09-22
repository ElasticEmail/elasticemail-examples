namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class WithTemplate
{
    public static async Task RunAsync()
    {
        var config = Ee.Config();
        var emailsApi = new EmailsApi(config);
        var templatesApi = new TemplatesApi(config);
        var templateName = Ee.Env("ELASTICEMAIL_TEMPLATE_NAME", "welcome-example");

        try
        {
            await EnsureTemplateAsync(templatesApi, templateName);

            // Merge values replace {placeholders} in the template subject and body.
            var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { Ee.To }),
                content: new EmailContent(
                    from: Ee.From,
                    templateName: templateName,
                    merge: new Dictionary<string, string> { ["firstname"] = "Ann", ["company"] = "Acme" })));

            Console.WriteLine("Template email sent successfully!");
            Console.WriteLine($"Transaction ID: {result.TransactionID}");
            Console.WriteLine($"Message ID: {result.MessageID}");
        }
        catch (ApiException e)
        {
            Ee.Fail("send template email", e);
        }
    }

    // Templates are referenced by name. Create it on first run.
    private static async Task EnsureTemplateAsync(TemplatesApi templatesApi, string templateName)
    {
        try
        {
            await templatesApi.TemplatesByNameGetAsync(templateName);
            Console.WriteLine($"Template \"{templateName}\" already exists.");
        }
        catch (ApiException e) when (e.ErrorCode == 404)
        {
            await templatesApi.TemplatesPostAsync(new TemplatePayload(
                name: templateName,
                subject: "Welcome, {firstname}!",
                body: new List<BodyPart>
                {
                    new BodyPart(BodyContentType.HTML,
                        "<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>"),
                },
                templateScope: TemplateScope.Personal));
            Console.WriteLine($"Template \"{templateName}\" created.");
        }
    }
}
