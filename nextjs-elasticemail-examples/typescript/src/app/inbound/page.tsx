import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";

export default function InboundPage() {
  const handlerCode = `// src/app/api/inbound/route.ts
export async function POST(request: Request) {
  if (!tokenOk(new URL(request.url).searchParams.get("token"))) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Elastic Email posts the parsed message as form fields
  const mail = await readEvent(request);
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

  return NextResponse.json({ received: true });
}`;

  const routeCode = `// Create the inbound route once (InboundRouteApi)
await inboundApi.inboundroutePost({
  Name: "examples-inbound",
  Filter: \`*@\${process.env.SENDING_DOMAIN}\`,
  FilterType: "EmailAddress",
  ActionType: "NotifyViaHttp",
  HttpAddress: \`\${process.env.PUBLIC_URL}/api/inbound?token=\${process.env.ELASTICEMAIL_WEBHOOK_TOKEN}\`,
});`;

  const curlCode = `curl -X POST "http://localhost:3000/api/inbound?token=change_me" \\
  -d "from_email=sender@example.com" \\
  -d "from_name=Sender" \\
  -d "subject=Test inbound" \\
  -d "body_text=Hello from curl" \\
  -d "att1_name=note.txt" \\
  -d "att1_content=$(printf 'attached text' | base64)"`;

  return (
    <main>
      <PageHeader
        title="Inbound Emails"
        description="Receive parsed emails through an Elastic Email inbound route and forward them."
        sourcePath="src/app/api/inbound/route.ts"
      />

      <div className="card">
        <h3>Setup Steps</h3>
        <ol>
          <li>
            Point the MX record of <code>SENDING_DOMAIN</code> at <code>mx.inbound.elasticemail.com</code>.
          </li>
          <li>
            Expose the dev server (for example <code>ngrok http 3000</code>) and set <code>PUBLIC_URL</code> to the
            HTTPS URL.
          </li>
          <li>
            Create an inbound route with action <code>NotifyViaHttp</code> and address{" "}
            <code>PUBLIC_URL/api/inbound?token=ELASTICEMAIL_WEBHOOK_TOKEN</code>, either in the dashboard or with the
            code below.
          </li>
          <li>Send an email to any address on the domain and watch the server log.</li>
        </ol>
      </div>

      <div className="card warning">
        <h3>Notes</h3>
        <ul>
          <li>Elastic Email does not sign these requests. The handler checks the shared token in the query string.</li>
          <li>
            Fields: <code>from_email</code>, <code>from_name</code>, <code>env_from</code>, <code>env_to_list</code>,{" "}
            <code>to_list</code>, <code>header_list</code>, <code>subject</code>, <code>body_text</code>,{" "}
            <code>body_html</code>, <code>attN_name</code>, <code>attN_content</code> (base64).
          </li>
          <li>Return 2xx quickly. Do heavy processing asynchronously.</li>
        </ul>
      </div>

      <h2>Handler</h2>
      <CodeBlock code={handlerCode} title="src/app/api/inbound/route.ts" />

      <h2>Creating the Route</h2>
      <CodeBlock code={routeCode} title="InboundRouteApi" />

      <h2>Test Locally</h2>
      <p className="muted">Simulate a notification with curl (uses the default token from .env.example):</p>
      <CodeBlock code={curlCode} title="curl" language="bash" />
    </main>
  );
}
