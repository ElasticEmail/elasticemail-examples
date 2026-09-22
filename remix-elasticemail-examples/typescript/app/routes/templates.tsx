import type { MetaFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const meta: MetaFunction = () => [{ title: "Templates - Elastic Email Examples" }];

const exampleCode = `// Templates are referenced by name. Create it once:
await templatesApi.templatesPost({
  Name: templateName,
  Subject: "Welcome, {firstname}!",
  Body: [{ ContentType: "HTML", Content: "<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>" }],
  TemplateScope: "Personal",
});

// Merge values replace {placeholders} in the template subject and body.
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    TemplateName: templateName,
    Merge: { firstname: "Ann", company: "Acme" },
  },
});`;

export default function Templates() {
  const fetcher = useFetcher<ApiResult>();
  const loading = fetcher.state !== "idle";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      { to: String(form.get("to")), firstName: String(form.get("firstName")), company: String(form.get("company")) },
      { method: "post", action: "/api/send-template", encType: "application/json" },
    );
  };

  return (
    <main>
      <PageHeader
        title="Email Templates"
        description="Send a stored Elastic Email template with merge fields. The template is created on first use."
        sourcePath="app/routes/api.send-template.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="firstName">First name (merge field)</label>
          <input id="firstName" name="firstName" type="text" defaultValue="Ann" required />
        </div>

        <div className="field">
          <label htmlFor="company">Company (merge field)</label>
          <input id="company" name="company" type="text" defaultValue="Acme" required />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Template Email"}
        </button>
      </form>

      <ResultDisplay data={fetcher.data} loading={loading} title="Email Sent" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
