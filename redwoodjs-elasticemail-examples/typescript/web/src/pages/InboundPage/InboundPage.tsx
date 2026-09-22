import { Metadata } from "@redwoodjs/web";
import { PageHeader } from "src/components/PageHeader";

const exampleCode = `// api/src/functions/inbound.ts
async function handle(event: APIGatewayEvent) {
  if (!tokenOk(query(event).get("token"))) {
    return json({ error: "Invalid token" }, 401);
  }

  // Elastic Email posts the parsed message as form fields
  const mail = await readEvent(event);
  const attachments = Object.keys(mail)
    .filter((k) => /^att\\d+_name$/.test(k))
    .map((k) => ({ name: mail[k], content: mail[k.replace("_name", "_content")] }));

  console.log("From:", mail.from_email, "Subject:", mail.subject);

  // Forward a copy to the team inbox
  await emailsApi.emailsTransactionalPost({
    Recipients: { To: [contactEmail] },
    Content: {
      From: from,
      ReplyTo: mail.from_email,
      Subject: \`Fwd: \${mail.subject}\`,
      Body: [{ ContentType: "HTML", Content: mail.body_html || \`<pre>\${mail.body_text}</pre>\` }],
      Attachments: attachments.map((a) => ({ Name: a.name, BinaryContent: a.content })),
    },
  });

  return json({ received: true });
}`;

const exampleCode2 = `// Create the inbound route once (InboundRouteApi)
await inboundApi.inboundroutePost({
  Name: "examples-inbound",
  Filter: \`*@\${process.env.SENDING_DOMAIN}\`,
  FilterType: "EmailAddress",
  ActionType: "NotifyViaHttp",
  HttpAddress: \`\${process.env.PUBLIC_URL}/.redwood/functions/inbound?token=\${process.env.ELASTICEMAIL_WEBHOOK_TOKEN}\`,
});`;

const exampleCode3 = `curl -X POST "http://localhost:8910/.redwood/functions/inbound?token=change_me" \\
  -d "from_email=sender@example.com" \\
  -d "from_name=Sender" \\
  -d "subject=Test inbound" \\
  -d "body_text=Hello from curl" \\
  -d "att1_name=note.txt" \\
  -d "att1_content=$(printf 'attached text' | base64)"`;

const InboundPage = () => {
  return (
    <main>
      <Metadata title="Inbound" description="Receive parsed emails through an Elastic Email inbound route and forward them." />

      <PageHeader title="Inbound Emails" description="Receive parsed emails through an Elastic Email inbound route and forward them." sourcePath="api/src/functions/inbound.ts" />

      <div className="card">
        <h3>Setup Steps</h3>
        <ol>
          <li>Point the MX record of <code>SENDING_DOMAIN</code> at <code>mx.inbound.elasticemail.com</code>.</li>
          <li>Expose the dev server (for example <code>ngrok http 8910</code>) and set <code>PUBLIC_URL</code> to the HTTPS URL.</li>
          <li>Create an inbound route with action <code>NotifyViaHttp</code> and address <code>PUBLIC_URL/.redwood/functions/inbound?token=ELASTICEMAIL_WEBHOOK_TOKEN</code>, either in the dashboard or with the code below.</li>
          <li>Send an email to any address on the domain and watch the server log.</li>
        </ol>
      </div>

      <div className="card warning">
        <h3>Notes</h3>
        <ul>
          <li>Elastic Email does not sign these requests. The handler checks the shared token in the query string.</li>
          <li>Fields: <code>from_email</code>, <code>from_name</code>, <code>env_from</code>, <code>env_to_list</code>, <code>to_list</code>, <code>header_list</code>, <code>subject</code>, <code>body_text</code>, <code>body_html</code>, <code>attN_name</code>, <code>attN_content</code> (base64).</li>
          <li>Return 2xx quickly. Do heavy processing asynchronously.</li>
        </ul>
      </div>

      <h2>Handler</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>

      <h2>Creating the Route</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode2}</code>
        </pre>
      </div>

      <h2>Test Locally</h2>
      <p className="muted">Simulate a notification with curl (uses the default token from .env.example):</p>
      <div className="code-block">
        <pre>
          <code>{exampleCode3}</code>
        </pre>
      </div>
    </main>
  );
};

export default InboundPage;
