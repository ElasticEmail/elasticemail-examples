import { Metadata } from "@redwoodjs/web";
import { useState, type FormEvent } from "react";
import { PageHeader } from "src/components/PageHeader";
import { ResultDisplay, type ApiResult } from "src/components/ResultDisplay";

const exampleCode = `// 1. Store the contact as Transactional (gets the confirmation, no campaigns yet)
await contactsApi.contactsPost([{ Email: email, FirstName: name, Status: "Transactional" }]);

// 2. Send a confirmation link signed with HMAC-SHA256(ELASTICEMAIL_WEBHOOK_TOKEN, email)
const confirmUrl = \`\${publicUrl}/.redwood/functions/doubleOptinConfirm?email=\${encodeURIComponent(email)}&token=\${hmac(email)}\`;
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [email] },
  Content: { From: from, Subject: "Confirm your subscription", Body: [{ ContentType: "HTML", Content: \`<a href="\${confirmUrl}">Confirm</a>\` }] },
});`;

const exampleCode2 = `// GET /.redwood/functions/doubleOptinConfirm?email=...&token=...
// After verifying the HMAC, add the contact to the list
await listsApi.listsByNameContactsPost(listName, { Emails: [email] });`;

const DoubleOptinPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/.redwood/functions/doubleOptinSubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          name: String(form.get("name") ?? ""),
        }),
      });
      const data: ApiResult = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <Metadata title="Double Opt-In" description="Subscribe a contact only after they confirm through an email link." />

      <PageHeader title="Double Opt-In" description="Subscribe a contact only after they confirm through an email link." sourcePath="api/src/functions/doubleOptinSubscribe.ts" />

      <div className="card">
        <h3>How it works</h3>
        <ol>
          <li>User submits their email address</li>
          <li>Contact is created with <code>Status: "Transactional"</code> and is not on the list yet</li>
          <li>A confirmation email with an HMAC-signed link is sent</li>
          <li><code>/.redwood/functions/doubleOptinConfirm</code> validates the token and calls <code>listsByNameContactsPost</code></li>
          <li>Alternative: point an Elastic Email webhook for Clicked events at <code>/.redwood/functions/doubleOptinWebhook</code></li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="name">Name (optional)</label>
          <input id="name" name="name" type="text" placeholder="Ann Example" />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Subscribing..." : "Subscribe"}
        </button>
      </form>

      <ResultDisplay data={result} loading={loading} title="Confirmation Sent" />

      <h2>Subscribe</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>

      <h2>Confirm</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode2}</code>
        </pre>
      </div>
    </main>
  );
};

export default DoubleOptinPage;
