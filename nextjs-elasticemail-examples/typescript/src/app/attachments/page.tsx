"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

export default function AttachmentsPage() {
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ data?: unknown; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/send-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await response.json();
      setResult(response.ok ? { data } : { error: data.error || "Failed to send email" });
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const exampleCode = `const encoded = Buffer.from("Sample Attachment\\n...").toString("base64");

await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Email with Attachment",
    Body: [{ ContentType: "HTML", Content: "<h1>Your attachment is ready</h1>" }],
    // BinaryContent is base64. Total message size limit applies.
    Attachments: [{ BinaryContent: encoded, Name: "sample.txt", ContentType: "text/plain" }],
  },
});`;

  return (
    <main>
      <PageHeader
        title="Email with Attachments"
        description="Attach a base64-encoded file to a transactional email."
        sourcePath="src/app/attachments/page.tsx"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="you@yourdomain.com" />
          <p className="hint">A generated sample.txt file is attached.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send with Attachment"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Email Sent" />

      <h2>Code Example</h2>
      <CodeBlock code={exampleCode} title="src/app/api/send-attachment/route.ts" />
    </main>
  );
}
