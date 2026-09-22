import type { MetaFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const meta: MetaFunction = () => [{ title: "Double Opt-In - Elastic Email Examples" }];

const subscribeCode = `// 1. Store the contact as Transactional (gets the confirmation, no campaigns yet)
await contactsApi.contactsPost([{ Email: email, FirstName: name, Status: "Transactional" }]);

// 2. Send a confirmation link signed with HMAC-SHA256(ELASTICEMAIL_WEBHOOK_TOKEN, email)
const confirmUrl = \`\${publicUrl}/api/double-optin/confirm?email=\${encodeURIComponent(email)}&token=\${hmac(email)}\`;
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [email] },
  Content: { From: from, Subject: "Confirm your subscription", Body: [{ ContentType: "HTML", Content: \`<a href="\${confirmUrl}">Confirm</a>\` }] },
});`;

const confirmCode = `// GET /api/double-optin/confirm?email=...&token=...
// After verifying the HMAC, add the contact to the list
await listsApi.listsByNameContactsPost(listName, { Emails: [email] });`;

export default function DoubleOptin() {
  const fetcher = useFetcher<ApiResult>();
  const loading = fetcher.state !== "idle";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      { email: String(form.get("email")), name: String(form.get("name") ?? "") },
      { method: "post", action: "/api/double-optin/subscribe", encType: "application/json" },
    );
  };

  return (
    <main>
      <PageHeader
        title="Double Opt-In"
        description="Subscribe a contact only after they confirm through an email link."
        sourcePath="app/routes/api.double-optin.subscribe.ts"
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
            <code>/api/double-optin/confirm</code> validates the token and calls <code>listsByNameContactsPost</code>
          </li>
          <li>
            Alternative: point an Elastic Email webhook for Clicked events at <code>/api/double-optin/webhook</code>
          </li>
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

      <ResultDisplay data={fetcher.data} loading={loading} title="Confirmation Sent" />

      <h2>Subscribe</h2>
      <div className="code-block">
        <pre>
          <code>{subscribeCode}</code>
        </pre>
      </div>

      <h2>Confirm</h2>
      <div className="code-block">
        <pre>
          <code>{confirmCode}</code>
        </pre>
      </div>
    </main>
  );
}
