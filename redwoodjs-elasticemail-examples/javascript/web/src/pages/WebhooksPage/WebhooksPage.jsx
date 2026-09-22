import { Metadata } from "@redwoodjs/web";
import { PageHeader } from "src/components/PageHeader";

const exampleCode = `// api/src/functions/webhook.ts
async function handle(event) {
  // Elastic Email does not sign webhooks. Check the shared ?token= instead.
  if (!tokenOk(query(event).get("token"))) {
    return json({ error: "Invalid token" }, 401);
  }

  // Query string (GET) or form fields (POST)
  const fields = await readEvent(event);

  if (!fields.status) {
    // Validation ping sent when the webhook is saved
    return json({ ok: true });
  }

  switch (fields.status) {
    case "Sent":         // fields.messageid
    case "Opened":       // fields.Country, fields.City
    case "Clicked":      // fields.target (clicked URL)
    case "Error":        // fields.category (bounce category)
    case "AbuseReport":
    case "Unsubscribed":
      console.log(fields.status, fields.to, fields.transaction);
  }

  return json({ received: true, status: fields.status });
}`;

const exampleCode2 = `// Create the webhook once (WebhookApi)
await webhookApi.webhookPost({
  Name: "examples-webhook",
  URL: \`\${process.env.PUBLIC_URL}/.redwood/functions/webhook?token=\${process.env.ELASTICEMAIL_WEBHOOK_TOKEN}\`,
  NotifyOncePerEmail: false,
  NotificationForSent: true,
  NotificationForOpened: true,
  NotificationForClicked: true,
  NotificationForUnsubscribed: true,
  NotificationForAbuseReport: true,
  NotificationForError: true,
});`;

const exampleCode3 = `# Validation ping (GET)
curl "http://localhost:8910/.redwood/functions/webhook?token=change_me"

# Event (POST, form-encoded)
curl -X POST "http://localhost:8910/.redwood/functions/webhook?token=change_me" \\
  -d "status=Clicked" \\
  -d "to=you@yourdomain.com" \\
  -d "transaction=abc123" \\
  -d "target=https://example.com/pricing"`;

const WebhooksPage = () => {
  return (
    <main>
      <Metadata title="Webhooks" description="Receive delivery and engagement events from Elastic Email." />

      <PageHeader
        title="Webhooks"
        description="Receive delivery and engagement events from Elastic Email."
        sourcePath="api/src/functions/webhook.ts"
      />

      <div className="card">
        <h3>Setup Steps</h3>
        <ol>
          <li>
            Expose the dev server (for example <code>ngrok http 8910</code>) and set <code>PUBLIC_URL</code>.
          </li>
          <li>
            In the Elastic Email dashboard (Settings, Notifications) add a webhook with URL{" "}
            <code>PUBLIC_URL/.redwood/functions/webhook?token=ELASTICEMAIL_WEBHOOK_TOKEN</code>, or create it with the
            code below.
          </li>
          <li>Elastic Email sends a GET to the URL on save. The handler must answer 2xx.</li>
          <li>Send an email from any example page and watch the server log.</li>
        </ol>
      </div>

      <div className="card warning">
        <h3>Event Parameters</h3>
        <ul>
          <li>
            <code>status</code>: Sent, Opened, Clicked, Error, AbuseReport, Unsubscribed
          </li>
          <li>
            <code>transaction</code>, <code>messageid</code>, <code>to</code>, <code>from</code>, <code>subject</code>,{" "}
            <code>date</code>, <code>channel</code>, <code>account</code>
          </li>
          <li>
            <code>category</code> (bounce category), <code>target</code> (clicked URL), <code>IP</code>,{" "}
            <code>Useragent</code>, <code>Country</code>, <code>City</code>
          </li>
        </ul>
      </div>

      <h2>Handler</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>

      <h2>Creating the Webhook</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode2}</code>
        </pre>
      </div>

      <h2>Test Locally</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode3}</code>
        </pre>
      </div>
    </main>
  );
};

export default WebhooksPage;
