import type { MetaFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const meta: MetaFunction = () => [{ title: "Attachments - Elastic Email Examples" }];

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

export default function Attachments() {
  const fetcher = useFetcher<ApiResult>();
  const loading = fetcher.state !== "idle";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      { to: String(form.get("to")) },
      { method: "post", action: "/api/send-attachment", encType: "application/json" },
    );
  };

  return (
    <main>
      <PageHeader
        title="Email with Attachments"
        description="Attach a base64-encoded file to a transactional email."
        sourcePath="app/routes/api.send-attachment.ts"
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
