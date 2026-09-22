"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

export default function TemplatesPage() {
  const [to, setTo] = useState("");
  const [firstName, setFirstName] = useState("Ann");
  const [company, setCompany] = useState("Acme");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ data?: unknown; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/send-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, firstName, company }),
      });
      const data = await response.json();
      setResult(response.ok ? { data } : { error: data.error || "Failed to send email" });
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

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
    Merge: { firstname: "${firstName}", company: "${company}" },
  },
});`;

  return (
    <main>
      <PageHeader
        title="Email Templates"
        description="Send a stored Elastic Email template with merge fields. The template is created on first use."
        sourcePath="src/app/templates/page.tsx"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="firstName">First name (merge field)</label>
          <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="company">Company (merge field)</label>
          <input id="company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} required />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Template Email"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Email Sent" />

      <h2>Code Example</h2>
      <CodeBlock code={exampleCode} title="src/app/api/send-template/route.ts" />
    </main>
  );
}
