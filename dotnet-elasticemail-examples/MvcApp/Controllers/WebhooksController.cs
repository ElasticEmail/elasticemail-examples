using System.Text.RegularExpressions;
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;
using Microsoft.AspNetCore.Mvc;

namespace MvcApp.Controllers;

[ApiController]
public class WebhooksController : ControllerBase
{
    private readonly EmailsApi _emailsApi;

    public WebhooksController(EmailsApi emailsApi)
    {
        _emailsApi = emailsApi;
    }

    // Elastic Email event notifications. Parameters arrive in the query string (GET) or as
    // form fields (POST): transaction, messageid, to, from, subject, date, status, category,
    // channel, target (clicked URL), IP, Useragent, Country, City.
    // Elastic Email sends a GET to validate the URL when the webhook is saved.
    [HttpGet("/webhook")]
    [HttpPost("/webhook")]
    public async Task<IActionResult> HandleWebhook()
    {
        if (!Ee.TokenOk(Request.Query["token"]))
        {
            return Unauthorized(new { error = "Invalid token" });
        }

        var ev = await Ee.ReadEventAsync(Request);
        var status = Ee.Sanitize(ev.GetValueOrDefault("status"));

        if (status.Length == 0)
        {
            // Validation ping or empty request
            return Ok(new { ok = true });
        }

        Console.WriteLine($"Webhook event: {status} to: {Ee.Sanitize(ev.GetValueOrDefault("to"))} transaction: {Ee.Sanitize(ev.GetValueOrDefault("transaction"))}");

        switch (status)
        {
            case "Sent":
                Console.WriteLine($"Email sent, message id: {Ee.Sanitize(ev.GetValueOrDefault("messageid"))}");
                break;
            case "Opened":
                Console.WriteLine($"Email opened from {Ee.Sanitize(ev.GetValueOrDefault("Country"))} {Ee.Sanitize(ev.GetValueOrDefault("City"))}");
                break;
            case "Clicked":
                Console.WriteLine($"Link clicked: {Ee.Sanitize(ev.GetValueOrDefault("target"))}");
                break;
            case "Error":
                Console.WriteLine($"Bounce/error, category: {Ee.Sanitize(ev.GetValueOrDefault("category"))}");
                break;
            case "AbuseReport":
                Console.WriteLine("Complaint received");
                break;
            case "Unsubscribed":
                Console.WriteLine("Recipient unsubscribed");
                break;
        }

        return Ok(new { received = true, status });
    }

    // Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
    // Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
    // subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
    [HttpPost("/inbound")]
    public async Task<IActionResult> HandleInbound()
    {
        if (!Ee.TokenOk(Request.Query["token"]))
        {
            return Unauthorized(new { error = "Invalid token" });
        }

        var mail = await Ee.ReadEventAsync(Request);
        var attachments = mail.Keys
            .Where(k => Regex.IsMatch(k, @"^att\d+_name$"))
            .Select(k => (Name: mail[k], Content: mail.GetValueOrDefault(k.Replace("_name", "_content"))))
            .ToList();

        Console.WriteLine($"Inbound email from: {Ee.Sanitize(mail.GetValueOrDefault("from_email"))} subject: {Ee.Sanitize(mail.GetValueOrDefault("subject"))}");
        Console.WriteLine($"Attachments: {(attachments.Count > 0 ? string.Join(", ", attachments.Select(a => a.Name)) : "none")}");

        // Forward a copy to the team inbox
        try
        {
            var bodyHtml = mail.GetValueOrDefault("body_html");
            if (string.IsNullOrEmpty(bodyHtml))
            {
                bodyHtml = $"<pre>{(mail.GetValueOrDefault("body_text") ?? "").Replace("<", "&lt;")}</pre>";
            }

            var result = await _emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { Ee.ContactEmail }),
                content: new EmailContent(
                    from: Ee.From,
                    replyTo: mail.GetValueOrDefault("from_email"),
                    subject: $"Fwd: {mail.GetValueOrDefault("subject") ?? "(no subject)"}",
                    body: new List<BodyPart> { new BodyPart(BodyContentType.HTML, bodyHtml) },
                    attachments: attachments
                        .Where(a => !string.IsNullOrEmpty(a.Content))
                        .Select(a => new MessageAttachment(binaryContent: Convert.FromBase64String(a.Content!), name: a.Name))
                        .ToList())));

            return Ok(new { received = true, forwardedMessageId = result.MessageID });
        }
        catch (ApiException e)
        {
            return Ee.ApiError(e);
        }
    }
}
