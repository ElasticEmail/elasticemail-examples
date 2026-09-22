import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const Route = createFileRoute("/prevent-threading")({
  component: PreventThreadingPage,
  head: () => ({ meta: [{ title: "Prevent Threading - Elastic Email Examples" }] }),
});

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

function PreventThreadingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/send-prevent-threading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: String(form.get("to") ?? ""),
          count: 3,
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
      <PageHeader title="Prevent Gmail Threading" description="Send three emails with the same subject that show up as separate conversations." sourcePath="src/routes/api/send-prevent-threading.ts" />

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

      <ResultDisplay data={result} loading={loading} title="Emails Sent" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
