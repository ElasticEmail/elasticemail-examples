import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay } from "../components/ResultDisplay";

export const meta = () => [{ title: "CID Attachments - Elastic Email Examples" }];

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

export default function CidAttachments() {
  const fetcher = useFetcher();
  const loading = fetcher.state !== "idle";

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      { to: String(form.get("to")) },
      { method: "post", action: "/api/send-cid", encType: "application/json" },
    );
  };

  return (
    <main>
      <PageHeader
        title="CID Attachments"
        description="Embed an inline image referenced by Content-ID."
        sourcePath="app/routes/api.send-cid.js"
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
