import { Metadata } from "@redwoodjs/web";
import { useState, type FormEvent } from "react";
import { PageHeader } from "src/components/PageHeader";
import { ResultDisplay, type ApiResult } from "src/components/ResultDisplay";

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

const CidAttachmentsPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/.redwood/functions/sendCid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: String(form.get("to") ?? ""),
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
      <Metadata title="CID Attachments" description="Embed an inline image referenced by Content-ID." />

      <PageHeader title="CID Attachments" description="Embed an inline image referenced by Content-ID." sourcePath="api/src/functions/sendCid.ts" />

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
};

export default CidAttachmentsPage;
