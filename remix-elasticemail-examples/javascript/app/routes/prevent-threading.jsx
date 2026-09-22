import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay } from "../components/ResultDisplay";

export const meta = () => [{ title: "Prevent Threading - Elastic Email Examples" }];

const exampleCode = `import { randomUUID } from "node:crypto";

// Gmail groups emails into threads based on subject and Message-ID/References headers.
// A unique X-Entity-Ref-ID header per email prevents this grouping.
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Order Confirmation", // Same subject every time
    Body: [{ ContentType: "HTML", Content: "<h1>Order Confirmation</h1>" }],
    Headers: { "X-Entity-Ref-ID": randomUUID() },
  },
});`;

export default function PreventThreading() {
  const fetcher = useFetcher();
  const loading = fetcher.state !== "idle";

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      { to: String(form.get("to")), count: 3 },
      { method: "post", action: "/api/send-prevent-threading", encType: "application/json" },
    );
  };

  return (
    <main>
      <PageHeader
        title="Prevent Gmail Threading"
        description="Send three emails with the same subject that show up as separate conversations."
        sourcePath="app/routes/api.send-prevent-threading.js"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@gmail.com" />
          <p className="hint">Use a Gmail address to see the effect.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send 3 Emails"}
        </button>
      </form>

      <ResultDisplay data={fetcher.data} loading={loading} title="Emails Sent" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
