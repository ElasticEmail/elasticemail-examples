"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

export default function DoubleOptinPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/double-optin/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await response.json();
      setResult(response.ok ? { data } : { error: data.error || "Failed to subscribe" });
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const subscribeCode = `// 1. Store the contact as Transactional (gets the confirmation, no campaigns yet)
await contactsApi.contactsPost([{ Email: email, FirstName: name, Status: "Transactional" }]);

// 2. Send a confirmation link signed with HMAC-SHA256(ELASTICEMAIL_WEBHOOK_TOKEN, email)
const confirmUrl = \`\${publicUrl}/double-optin/confirm?email=\${encodeURIComponent(email)}&token=\${hmac(email)}\`;
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [email] },
  Content: { From: from, Subject: "Confirm your subscription", Body: [{ ContentType: "HTML", Content: \`<a href="\${confirmUrl}">Confirm</a>\` }] },
});`;

  const confirmCode = `// GET /double-optin/confirm?email=...&token=...
// After verifying the HMAC, add the contact to the list
await listsApi.listsByNameContactsPost(listName, { Emails: [email] });`;

  return (
    <main>
      <PageHeader
        title="Double Opt-In"
        description="Subscribe a contact only after they confirm through an email link."
        sourcePath="src/app/double-optin/subscribe/route.js"
      />

      <div className="card">
        <h3>How it works</h3>
        <ol>
          <li>User submits their email address</li>
          <li>
            Contact is created with <code>Status: "Transactional"</code> and is not on the list yet
          </li>
          <li>A confirmation email with an HMAC-signed link is sent</li>
          <li>
            <code>/double-optin/confirm</code> validates the token and calls <code>listsByNameContactsPost</code>
          </li>
          <li>
            Alternative: point an Elastic Email webhook for Clicked events at <code>/double-optin/webhook</code>
          </li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="name">Name (optional)</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ann Example" />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Subscribing..." : "Subscribe"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Confirmation Sent" />

      <h2>Subscribe</h2>
      <CodeBlock code={subscribeCode} title="src/app/double-optin/subscribe/route.js" />

      <h2>Confirm</h2>
      <CodeBlock code={confirmCode} title="src/app/double-optin/confirm/route.js" />
    </main>
);
}
