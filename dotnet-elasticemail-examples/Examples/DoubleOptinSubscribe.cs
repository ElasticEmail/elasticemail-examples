namespace ElasticEmailExamples;

using System.Security.Cryptography;
using System.Text;
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class DoubleOptinSubscribe
{
    // Usage: dotnet run -- double-optin-subscribe user@example.com "John Doe"
    public static async Task RunAsync(string[] args)
    {
        if (args.Length == 0)
        {
            Console.Error.WriteLine("Usage: dotnet run -- double-optin-subscribe <email> [\"Name\"]");
            Environment.Exit(1);
        }

        var email = args[0];
        var name = args.Length > 1 ? args[1] : "";

        var config = Ee.Config();
        var contactsApi = new ContactsApi(config);
        var emailsApi = new EmailsApi(config);

        // The confirm link carries an HMAC of the email so the confirm endpoint can trust it.
        var confirmToken = Hmac(Ee.WebhookToken, email);
        var confirmUrl = $"{Ee.PublicUrl}/double-optin/confirm?email={Uri.EscapeDataString(email)}&token={confirmToken}";

        var nameParts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        try
        {
            // Step 1: store the contact without adding it to the marketing list.
            // Status "Transactional" allows sending the confirmation but excludes it from campaigns.
            await contactsApi.ContactsPostAsync(new List<ContactPayload>
            {
                new ContactPayload(
                    email: email,
                    firstName: nameParts.FirstOrDefault() ?? "",
                    lastName: string.Join(' ', nameParts.Skip(1)),
                    status: ContactStatus.Transactional),
            });
            Console.WriteLine($"Contact stored (unconfirmed): {email}");

            // Step 2: send the confirmation email
            var greeting = string.IsNullOrEmpty(name) ? "Welcome!" : $"Welcome, {name}!";
            var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { email }),
                content: new EmailContent(
                    from: Ee.From,
                    subject: "Confirm your subscription",
                    body: new List<BodyPart>
                    {
                        new BodyPart(BodyContentType.HTML, $"""
                            <div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
                              <h1>{greeting}</h1>
                              <p>Please confirm your subscription to our newsletter.</p>
                              <a href="{confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
                            </div>
                            """),
                        new BodyPart(BodyContentType.PlainText, $"{greeting}\n\nConfirm your subscription: {confirmUrl}"),
                    })));

            Console.WriteLine($"Confirmation email sent. Message ID: {result.MessageID}");
            Console.WriteLine($"Confirm URL: {confirmUrl}");
            Console.WriteLine("\nWhen the link is opened, GET /double-optin/confirm in MinimalApiApp adds the contact to the list.");
        }
        catch (ApiException e)
        {
            Ee.Fail("double opt-in subscribe", e);
        }
    }

    public static string Hmac(string secret, string message)
    {
        var hash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(message));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
