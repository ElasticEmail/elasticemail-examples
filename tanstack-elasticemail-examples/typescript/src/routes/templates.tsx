import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
  head: () => ({ meta: [{ title: "Templates - Elastic Email Examples" }] }),
});

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

function TemplatesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/send-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: String(form.get("to") ?? ""),
          firstName: String(form.get("firstName") ?? ""),
          company: String(form.get("company") ?? ""),
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
      <PageHeader title="Email Templates" description="Send a stored Elastic Email template with merge fields. The template is created on first use." sourcePath="src/routes/api/send-template.ts" />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="firstName">First name (merge field)</label>
          <input id="firstName" name="firstName" type="text" required defaultValue="Ann" />
        </div>

        <div className="field">
          <label htmlFor="company">Company (merge field)</label>
          <input id="company" name="company" type="text" required defaultValue="Acme" />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Template Email"}
        </button>
      </form>

      <ResultDisplay data={result} loading={loading} title="Email Sent" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
