<script setup>
useHead({ title: "Webhooks - Elastic Email Examples" });

const handlerCode = `// server/api/webhook.js (no method suffix: handles GET and POST)
export default defineEventHandler(async (event) => {
  // Elastic Email does not sign webhooks. Check the shared ?token= instead.
  if (!tokenOk(getQuery(event).token)) {
    return fail(event, 401, "Invalid token");
  }

  // Query string (GET) or form fields (POST)
  const payload = await readEvent(event);

  if (!payload.status) {
    // Validation ping sent when the webhook is saved
    return { ok: true };
  }

  switch (payload.status) {
    case "Sent":         // payload.messageid
    case "Opened":       // payload.Country, payload.City
    case "Clicked":      // payload.target (clicked URL)
    case "Error":        // payload.category (bounce category)
    case "AbuseReport":
    case "Unsubscribed":
      console.log(payload.status, payload.to, payload.transaction);
  }

  return { received: true, status: payload.status };
});`;

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
curl "http://localhost:3000/api/webhook?token=change_me"

# Event (POST, form-encoded)
curl -X POST "http://localhost:3000/api/webhook?token=change_me" \\
  -d "status=Clicked" \\
  -d "to=you@yourdomain.com" \\
  -d "transaction=abc123" \\
  -d "target=https://example.com/pricing"`;
</script>

<template>
  <main>
    <PageHeader
      title="Webhooks"
      description="Receive delivery and engagement events from Elastic Email."
      source-path="server/api/webhook.js"
    />

    <div class="card">
      <h3>Setup Steps</h3>
      <ol>
        <li>Expose the dev server (for example <code>ngrok http 3000</code>) and set <code>PUBLIC_URL</code>.</li>
        <li>
          In the Elastic Email dashboard (Settings, Notifications) add a webhook with URL
          <code>PUBLIC_URL/api/webhook?token=ELASTICEMAIL_WEBHOOK_TOKEN</code>, or create it with the code below.
        </li>
        <li>Elastic Email sends a GET to the URL on save. The handler must answer 2xx.</li>
        <li>Send an email from any example page and watch the server log.</li>
      </ol>
    </div>

    <div class="card warning">
      <h3>Event Parameters</h3>
      <ul>
        <li><code>status</code>: Sent, Opened, Clicked, Error, AbuseReport, Unsubscribed</li>
        <li>
          <code>transaction</code>, <code>messageid</code>, <code>to</code>, <code>from</code>, <code>subject</code>,
          <code>date</code>, <code>channel</code>, <code>account</code>
        </li>
        <li>
          <code>category</code> (bounce category), <code>target</code> (clicked URL), <code>IP</code>,
          <code>Useragent</code>, <code>Country</code>, <code>City</code>
        </li>
      </ul>
    </div>

    <h2>Handler</h2>
    <div class="code-block"><pre><code>{{ handlerCode }}</code></pre></div>

    <h2>Creating the Webhook</h2>
    <div class="code-block"><pre><code>{{ createCode }}</code></pre></div>

    <h2>Test Locally</h2>
    <div class="code-block"><pre><code>{{ curlCode }}</code></pre></div>
  </main>
</template>
