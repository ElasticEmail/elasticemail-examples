namespace ElasticEmailExamples;

using System.Text;
using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class WithAttachments
{
    public static async Task RunAsync()
    {
        var emailsApi = new EmailsApi(Ee.Config());

        var fileContent = "Sample Attachment\n==================\n\nThis file was attached to your email.\n"
            + $"Sent at: {DateTime.UtcNow:O}\n";

        try
        {
            var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { Ee.To }),
                content: new EmailContent(
                    from: Ee.From,
                    subject: "Email with Attachment",
                    body: new List<BodyPart>
                    {
                        new BodyPart(BodyContentType.HTML,
                            "<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>"),
                    },
                    // BinaryContent is sent as base64. Total message size limit applies (see account limits).
                    attachments: new List<MessageAttachment>
                    {
                        new MessageAttachment(
                            binaryContent: Encoding.UTF8.GetBytes(fileContent),
                            name: "sample.txt",
                            contentType: "text/plain"),
                    })));

            Console.WriteLine("Email with attachment sent successfully!");
            Console.WriteLine($"Transaction ID: {result.TransactionID}");
            Console.WriteLine($"Message ID: {result.MessageID}");
        }
        catch (ApiException e)
        {
            Ee.Fail("send email", e);
        }
    }
}
