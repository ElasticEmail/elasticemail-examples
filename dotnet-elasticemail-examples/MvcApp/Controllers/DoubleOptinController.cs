using System.Security.Cryptography;
using System.Text;
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;
using Microsoft.AspNetCore.Mvc;

namespace MvcApp.Controllers;

[ApiController]
public class DoubleOptinController : ControllerBase
{
    private readonly EmailsApi _emailsApi;
    private readonly ContactsApi _contactsApi;
    private readonly ListsApi _listsApi;

    public DoubleOptinController(EmailsApi emailsApi, ContactsApi contactsApi, ListsApi listsApi)
    {
        _emailsApi = emailsApi;
        _contactsApi = contactsApi;
        _listsApi = listsApi;
    }

    [HttpPost("/double-optin/subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest body)
    {
        var email = body.Email;
        var name = body.Name ?? "";

        if (string.IsNullOrEmpty(email))
        {
            return BadRequest(new { error = "Missing required field: email" });
        }

        var confirmUrl = $"{Ee.PublicUrl}/double-optin/confirm?email={Uri.EscapeDataString(email)}&token={Ee.Hmac(email)}";
        var greeting = string.IsNullOrEmpty(name) ? "Welcome!" : $"Welcome, {name}!";

        try
        {
            // Stored as Transactional so it receives the confirmation but no campaigns yet
            await _contactsApi.ContactsPostAsync(new List<ContactPayload>
            {
                new ContactPayload(
                    email: email,
                    firstName: name.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "",
                    status: ContactStatus.Transactional),
            });

            var result = await _emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
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
                    })));

            return Ok(new { success = true, message = "Confirmation email sent", messageId = result.MessageID });
        }
        catch (ApiException e)
        {
            return Ee.ApiError(e);
        }
    }

    [HttpGet("/double-optin/confirm")]
    public async Task<IActionResult> Confirm([FromQuery] string? email, [FromQuery] string? token)
    {
        email ??= "";
        var expected = Encoding.UTF8.GetBytes(Ee.Hmac(email));
        var given = Encoding.UTF8.GetBytes(token ?? "");
        if (email.Length == 0 || !CryptographicOperations.FixedTimeEquals(expected, given))
        {
            return BadRequest(new { error = "Invalid confirmation link" });
        }

        try
        {
            await _listsApi.ListsByNameContactsPostAsync(Ee.ListName, new EmailsPayload(emails: new List<string> { email }));
            var redirectUrl = Environment.GetEnvironmentVariable("CONFIRM_REDIRECT_URL");
            if (!string.IsNullOrEmpty(redirectUrl))
            {
                return Redirect(redirectUrl);
            }
            return Ok(new { confirmed = true, email, list = Ee.ListName });
        }
        catch (ApiException e)
        {
            return Ee.ApiError(e);
        }
    }

    // Click-tracking based confirmation: create a webhook for Clicked events pointing here.
    [HttpPost("/double-optin/webhook")]
    public async Task<IActionResult> Webhook()
    {
        if (!Ee.TokenOk(Request.Query["token"]))
        {
            return Unauthorized(new { error = "Invalid token" });
        }

        var ev = await Ee.ReadEventAsync(Request);
        var status = ev.GetValueOrDefault("status");
        var target = ev.GetValueOrDefault("target") ?? "";
        var to = ev.GetValueOrDefault("to") ?? "";

        if (status != "Clicked" || !target.Contains("/double-optin/confirm"))
        {
            return Ok(new { received = true, status = Ee.Sanitize(status), message = "Event ignored" });
        }

        try
        {
            await _listsApi.ListsByNameContactsPostAsync(Ee.ListName, new EmailsPayload(emails: new List<string> { to }));
            return Ok(new { received = true, confirmed = true, email = Ee.Sanitize(to) });
        }
        catch (ApiException e)
        {
            return Ee.ApiError(e);
        }
    }
}

public record SubscribeRequest(string? Email, string? Name);
