import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "../components/PageHeader";

export const Route = createFileRoute("/webhooks")({
  component: WebhooksPage,
  head: () => ({ meta: [{ title: "Webhooks - Elastic Email Examples" }] }),
});

const exampleCode = `// src/routes/api/webhook.ts
async function handle(request: Request) {
  // Signed webhooks (ELASTICEMAIL_WEBHOOK_SECRET set): verify X-ElasticEmail-Signature
  // over the raw body, then parse the JSON body. Unsigned webhooks: check ?token= instead.
  const fields = await readWebhook(request);
  if (!fields) {
    return json({ error: "Invalid signature or token" }, 401);
  }

  if (!fields.status) {
    // Validation ping or test event without a status
    return json({ ok: true });
  }

  switch (fields.status) {
    case "Sent":         // fields.messageid
    case "Opened":       // fields.country, fields.city
    case "Clicked":      // fields.target (clicked URL)
    case "Error":        // fields.category (bounce category)
    case "AbuseReport":
    case "Unsubscribed":
      console.log(fields.status, fields.to, fields.transaction);
  }

  return json({ received: true, status: fields.status });
}`;

const exampleCode2 = `// Create a signed webhook once (WebhookApi). EnableSigning and DeliveryMethod
// can't be changed later.
const { data: webhook } = await webhookApi.webhookPost({
  Name: "examples-webhook",
  URL: \`\${process.env.PUBLIC_URL}/api/webhook\`, // no ?token= needed when signed
  EnableSigning: true,
  DeliveryMethod: WebhookDeliveryMethod.PostJson, // POST with a JSON body
  NotifyOncePerEmail: false,
  NotificationForSent: true,
  NotificationForOpened: true,
  NotificationForClicked: true,
  NotificationForUnsubscribed: true,
  NotificationForAbuseReport: true,
  NotificationForError: true,
});

// SigningSecret (whsec_...) is returned only in this response.
// Store it as ELASTICEMAIL_WEBHOOK_SECRET.
console.log(webhook.SigningSecret);

// Rotate it later. There is no grace period: update ELASTICEMAIL_WEBHOOK_SECRET right away.
const { data: rotated } = await webhookApi.webhookByPublicidSecretRotatePost(webhook.WebhookID!);
console.log(rotated.SigningSecret);`;

const exampleCode3 = `# Signed POST + JSON (ELASTICEMAIL_WEBHOOK_SECRET=whsec_test_secret)
BODY='{"status":"Clicked","to":"you@yourdomain.com","transaction":"abc123","target":"https://example.com/pricing"}'
TS=$(date +%s)
SIG=$(printf '%s\\nPOST\\n/api/webhook\\n%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "whsec_test_secret" | sed 's/^.* //')
curl -X POST "http://localhost:3000/api/webhook" \\
  -H "Content-Type: application/json" \\
  -H "X-ElasticEmail-Timestamp: $TS" \\
  -H "X-ElasticEmail-Signature: v1=$SIG" \\
  -d "$BODY"

# Unsigned webhook (ELASTICEMAIL_WEBHOOK_SECRET empty): fields in the query string + ?token=
curl "http://localhost:3000/api/webhook?token=change_me&status=Clicked&to=you%40yourdomain.com&transaction=abc123"`;

function WebhooksPage() {
  return (
    <main>
      <PageHeader title="Webhooks" description="Receive delivery and engagement events from Elastic Email." sourcePath="src/routes/api/webhook.ts" />

      <div className="card">
        <h3>Setup Steps</h3>
        <ol>
          <li>Expose the dev server (for example <code>ngrok http 3000</code>) and set <code>PUBLIC_URL</code>.</li>
          <li>Create the webhook with the code below (<code>EnableSigning</code>, <code>DeliveryMethod: PostJson</code>, URL <code>PUBLIC_URL/api/webhook</code>) and set <code>ELASTICEMAIL_WEBHOOK_SECRET</code> to the returned <code>SigningSecret</code>, which is shown only once. For an unsigned webhook (for example one added in the dashboard under Settings, Notifications) use <code>PUBLIC_URL/api/webhook?token=ELASTICEMAIL_WEBHOOK_TOKEN</code> and leave the secret empty.</li>
          <li>The test event sent when a signed webhook is created arrives before the app knows the secret. Elastic Email accepts the 401 and still creates the webhook.</li>
          <li>Send an email from any example page and watch the server log.</li>
        </ol>
      </div>

      <div className="card warning">
        <h3>Event Parameters</h3>
        <ul>
          <li><code>status</code>: Sent, Opened, Clicked, Error, AbuseReport, Unsubscribed</li>
          <li><code>transaction</code>, <code>messageid</code>, <code>to</code>, <code>from</code>, <code>subject</code>, <code>date</code>, <code>channel</code>, <code>account</code></li>
          <li><code>category</code> (bounce category), <code>target</code> (clicked URL), <code>ip</code>, <code>useragent</code>, <code>country</code>, <code>city</code></li>
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
}
