import { Metadata } from "@redwoodjs/web";
import { useState } from "react";
import { PageHeader } from "src/components/PageHeader";
import { ResultDisplay } from "src/components/ResultDisplay";

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

const AttachmentsPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/.redwood/functions/sendAttachment", {
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
      <Metadata title="Attachments" description="Attach a base64-encoded file to a transactional email." />

      <PageHeader
        title="Email with Attachments"
        description="Attach a base64-encoded file to a transactional email."
        sourcePath="api/src/functions/sendAttachment.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@yourdomain.com" />
          <p className="hint">A generated sample.txt file is attached.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send with Attachment"}
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

export default AttachmentsPage;
