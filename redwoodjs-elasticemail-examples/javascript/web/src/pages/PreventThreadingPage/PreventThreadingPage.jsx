import { Metadata } from "@redwoodjs/web";
import { useState } from "react";
import { PageHeader } from "src/components/PageHeader";
import { ResultDisplay } from "src/components/ResultDisplay";

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

const PreventThreadingPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/.redwood/functions/sendPreventThreading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: String(form.get("to") ?? ""),
          count: 3,
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
      <Metadata
        title="Prevent Threading"
        description="Send three emails with the same subject that show up as separate conversations."
      />

      <PageHeader
        title="Prevent Gmail Threading"
        description="Send three emails with the same subject that show up as separate conversations."
        sourcePath="api/src/functions/sendPreventThreading.ts"
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

      <ResultDisplay data={result} loading={loading} title="Emails Sent" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
};

export default PreventThreadingPage;
