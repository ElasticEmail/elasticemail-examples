import type { MetaFunction } from "@remix-run/node";
import { PageHeader } from "../components/PageHeader";

export const meta: MetaFunction = () => [{ title: "Webhooks - Elastic Email Examples" }];

const handlerCode = `// app/routes/api.webhook.ts
async function handle(request: Request) {
  // Elastic Email does not sign webhooks. Check the shared ?token= instead.
  if (!tokenOk(new URL(request.url).searchParams.get("token"))) {
    return json({ error: "Invalid token" }, { status: 401 });
  }

  // Query string (GET) or form fields (POST)
  const event = await readEvent(request);

  if (!event.status) {
    // Validation ping sent when the webhook is saved
    return json({ ok: true });
  }

  switch (event.status) {
    case "Sent":         // event.messageid
    case "Opened":       // event.Country, event.City
    case "Clicked":      // event.target (clicked URL)
    case "Error":        // event.category (bounce category)
    case "AbuseReport":
    case "Unsubscribed":
      console.log(event.status, event.to, event.transaction);
  }

  return json({ received: true, status: event.status });
}

export const loader = ({ request }) => handle(request);
export const action = ({ request }) => handle(request);`;

const createCode = `// Create the webhook once (WebhookApi)
await webhookApi.webhookPost({
  Name: "examples-webhook",
  URL: \`\${process.env.PUBLIC_URL}/api/webhook?token=\${process.env.ELASTICEMAIL_WEBHOOK_TOKEN}\`,
  NotifyOncePerEmail: false,
  NotificationForSent: true,
  NotificationForOpened: true,
  NotificationForClicked: true,
  NotificationForUnsubscribed: true,
  NotificationForAbuseReport: true,
  NotificationForError: true,
});`;

const curlCode = `# Validation ping (GET)
curl "http://localhost:5173/api/webhook?token=change_me"

# Event (POST, form-encoded)
curl -X POST "http://localhost:5173/api/webhook?token=change_me" \\
  -d "status=Clicked" \\
  -d "to=you@yourdomain.com" \\
  -d "transaction=abc123" \\
  -d "target=https://example.com/pricing"`;

export default function Webhooks() {
  return (
    <main>
      <PageHeader
        title="Webhooks"
        description="Receive delivery and engagement events from Elastic Email."
        sourcePath="app/routes/api.webhook.ts"
      />

      <div className="card">
        <h3>Setup Steps</h3>
        <ol>
          <li>
            Expose the dev server (for example <code>ngrok http 5173</code>) and set <code>PUBLIC_URL</code>.
          </li>
          <li>
            In the Elastic Email dashboard (Settings, Notifications) add a webhook with URL{" "}
            <code>PUBLIC_URL/api/webhook?token=ELASTICEMAIL_WEBHOOK_TOKEN</code>, or create it with the code below.
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
            <code>transaction</code>, <code>messageid</code>, <code>to</code>, <code>from</code>,{" "}
            <code>subject</code>, <code>date</code>, <code>channel</code>, <code>account</code>
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
          <code>{handlerCode}</code>
        </pre>
      </div>

      <h2>Creating the Webhook</h2>
      <div className="code-block">
        <pre>
          <code>{createCode}</code>
        </pre>
      </div>

      <h2>Test Locally</h2>
      <div className="code-block">
        <pre>
          <code>{curlCode}</code>
        </pre>
      </div>
    </main>
  );
}
