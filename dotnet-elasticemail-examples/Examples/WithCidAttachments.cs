namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class WithCidAttachments
{
    // Minimal 1x1 PNG placeholder (base64-encoded)
    private const string PlaceholderImage =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    public static async Task RunAsync()
    {
        var emailsApi = new EmailsApi(Ee.Config());

        // Elastic Email derives the Content-ID of an attachment from its file name.
        // Reference the attachment Name after "cid:" to embed it inline.
        try
        {
            var result = await emailsApi.EmailsTransactionalPostAsync(new EmailTransactionalMessageData(
                recipients: new TransactionalRecipient(to: new List<string> { Ee.To }),
                content: new EmailContent(
                    from: Ee.From,
                    subject: "Email with Inline Image",
                    body: new List<BodyPart>
                    {
                        new BodyPart(BodyContentType.HTML, """
                            <div style="font-family: Arial, sans-serif; padding: 20px;">
                              <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
                              <h1>Welcome!</h1>
                              <p>This email contains an inline image referenced by Content-ID.</p>
                            </div>
                            """),
                    },
                    attachments: new List<MessageAttachment>
                    {
                        new MessageAttachment(
                            binaryContent: Convert.FromBase64String(PlaceholderImage),
                            name: "logo.png",
                            contentType: "image/png"),
                    })));

            Console.WriteLine("Email with inline image sent successfully!");
            Console.WriteLine($"Transaction ID: {result.TransactionID}");
            Console.WriteLine($"Message ID: {result.MessageID}");
        }
        catch (ApiException e)
        {
            Ee.Fail("send email", e);
        }
    }
}
