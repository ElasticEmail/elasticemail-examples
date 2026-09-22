import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay } from "../components/ResultDisplay";

export const Route = createFileRoute("/cid-attachments")({
  component: CidAttachmentsPage,
  head: () => ({ meta: [{ title: "CID Attachments - Elastic Email Examples" }] }),
});

const exampleCode = `// Elastic Email derives the Content-ID from the attachment file name.
// Reference the attachment Name after "cid:" in the HTML.
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Email with Inline Image",
    Body: [{ ContentType: "HTML", Content: '<img src="cid:logo.png" alt="Logo" />' }],
    Attachments: [{ BinaryContent: pngBase64, Name: "logo.png", ContentType: "image/png" }],
  },
});`;

function CidAttachmentsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/send-cid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: String(form.get("to") ?? ""),
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <PageHeader
        title="CID Attachments"
        description="Embed an inline image referenced by Content-ID."
        sourcePath="src/routes/api/send-cid.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@yourdomain.com" />
          <p className="hint">A 1x1 placeholder PNG is embedded as logo.png.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send with Inline Image"}
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
