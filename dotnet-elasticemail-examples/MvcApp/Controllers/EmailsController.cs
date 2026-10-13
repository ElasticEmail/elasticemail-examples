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
    public async Task<IActionResult> Send(
        [FromBody] SendRequest body,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        if (string.IsNullOrEmpty(body.To) || string.IsNullOrEmpty(body.Subject) || string.IsNullOrEmpty(body.Message))
        {
            return BadRequest(new { error = "Missing required fields: to, subject, message" });
        }

        // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new one.
        if (string.IsNullOrEmpty(idempotencyKey))
        {
            idempotencyKey = Guid.NewGuid().ToString();
        }

        try
        {
            var result = await _emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { body.To }),
                content: new EmailContent(
                    from: Ee.From,
                    subject: body.Subject,
                    body: new List<BodyPart> { new BodyPart(BodyContentType.HTML, $"<p>{body.Message}</p>") })),
                idempotencyKey: idempotencyKey);
            // null means no response from Elastic Email (network error, timeout): safe to retry with the same key.
            if (result == null)
            {
                return StatusCode(502, new { error = "No response from Elastic Email" });
            }

            return Ok(new { success = true, transactionId = result.TransactionID, messageId = result.MessageID });
        }
        catch (ApiException e)
        {
            return Ee.ApiError(e);
        }
    }
}

public record SendRequest(string? To, string? Subject, string? Message);
