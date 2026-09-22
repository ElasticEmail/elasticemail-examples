using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;
using Microsoft.AspNetCore.Mvc;

namespace MvcApp.Controllers;

[ApiController]
public class EmailsController : ControllerBase
{
    private readonly EmailsApi _emailsApi;

    public EmailsController(EmailsApi emailsApi)
    {
        _emailsApi = emailsApi;
    }

    [HttpPost("/send")]
    public async Task<IActionResult> Send([FromBody] SendRequest body)
    {
        if (string.IsNullOrEmpty(body.To) || string.IsNullOrEmpty(body.Subject) || string.IsNullOrEmpty(body.Message))
        {
            return BadRequest(new { error = "Missing required fields: to, subject, message" });
        }

        try
        {
            var result = await _emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { body.To }),
                content: new EmailContent(
                    from: Ee.From,
                    subject: body.Subject,
                    body: new List<BodyPart> { new BodyPart(BodyContentType.HTML, $"<p>{body.Message}</p>") })));

            return Ok(new { success = true, transactionId = result.TransactionID, messageId = result.MessageID });
        }
        catch (ApiException e)
        {
            return Ee.ApiError(e);
        }
    }
}

public record SendRequest(string? To, string? Subject, string? Message);
