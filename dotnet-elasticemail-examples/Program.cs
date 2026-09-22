using ElasticEmailExamples;

if (args.Length == 0)
{
    Console.WriteLine("Usage: dotnet run -- <example> [args...]");
    Console.WriteLine();
    Console.WriteLine("Available examples:");
    Console.WriteLine("  basic-send               - Send a simple transactional email");
    Console.WriteLine("  batch-send               - Bulk send with merge fields");
    Console.WriteLine("  with-attachments         - Send email with a file attachment");
    Console.WriteLine("  with-cid-attachments     - Send email with an inline image");
    Console.WriteLine("  with-template            - Send email using a template");
    Console.WriteLine("  scheduled-send           - Delay delivery with TimeOffset");
    Console.WriteLine("  prevent-threading        - Prevent Gmail conversation threading");
    Console.WriteLine("  contacts                 - Manage contacts and lists");
    Console.WriteLine("  domains                  - Manage sending domains");
    Console.WriteLine("  email-status             - Delivery status by transaction id");
    Console.WriteLine("  webhooks                 - Manage webhooks");
    Console.WriteLine("  inbound                  - Manage inbound routes");
    Console.WriteLine("  double-optin-subscribe   - Create contact + send confirmation");
    Console.WriteLine("  double-optin-webhook     - Click-based confirmation server");
    Console.WriteLine("  suppressions             - Unsubscribes, bounces, complaints");
    Console.WriteLine("  email-verification       - Verify an email address");
    Console.WriteLine("  statistics               - Account statistics");
    Console.WriteLine("  sub-accounts             - Sub-accounts (read-only by default)");
    return;
}

var example = args[0];
var exampleArgs = args.Skip(1).ToArray();

try
{
    switch (example)
    {
        case "basic-send":
            await BasicSend.RunAsync();
            break;
        case "batch-send":
            await BatchSend.RunAsync();
            break;
        case "with-attachments":
            await WithAttachments.RunAsync();
            break;
        case "with-cid-attachments":
            await WithCidAttachments.RunAsync();
            break;
        case "with-template":
            await WithTemplate.RunAsync();
            break;
        case "scheduled-send":
            await ScheduledSend.RunAsync();
            break;
        case "prevent-threading":
            await PreventThreading.RunAsync();
            break;
        case "contacts":
            await Contacts.RunAsync();
            break;
        case "domains":
            await Domains.RunAsync();
            break;
        case "email-status":
            await EmailStatus.RunAsync(exampleArgs);
            break;
        case "webhooks":
            await Webhooks.RunAsync();
            break;
        case "inbound":
            await Inbound.RunAsync();
            break;
        case "double-optin-subscribe":
            await DoubleOptinSubscribe.RunAsync(exampleArgs);
            break;
        case "double-optin-webhook":
            await DoubleOptinWebhook.RunAsync();
            break;
        case "suppressions":
            await Suppressions.RunAsync(exampleArgs);
            break;
        case "email-verification":
            await EmailVerification.RunAsync(exampleArgs);
            break;
        case "statistics":
            await Statistics.RunAsync();
            break;
        case "sub-accounts":
            await SubAccounts.RunAsync();
            break;
        default:
            Console.WriteLine($"Unknown example: {example}");
            Console.WriteLine("Run 'dotnet run' without arguments to see available examples.");
            Environment.Exit(1);
            break;
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Error: {ex.Message}");
    Environment.Exit(1);
}
