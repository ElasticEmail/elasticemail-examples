"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

export default function PreventThreadingPage() {
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/send-prevent-threading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, count: 3 }),
      });
      const data = await response.json();
      setResult(response.ok ? { data } : { error: data.error || "Failed to send emails" });
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <main>
      <PageHeader
        title="Prevent Gmail Threading"
        description="Send three emails with the same subject that show up as separate conversations."
        sourcePath="src/app/prevent-threading/page.jsx"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="you@gmail.com" />
          <p className="hint">Use a Gmail address to see the effect.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send 3 Emails"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Emails Sent" />

      <h2>Code Example</h2>
      <CodeBlock code={exampleCode} title="src/app/api/send-prevent-threading/route.js" />
    </main>
);
}
