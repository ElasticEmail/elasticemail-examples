"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

export default function SchedulingPage() {
  const [to, setTo] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ data?: unknown; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/send-scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, delayMinutes }),
      });
      const data = await response.json();
      setResult(response.ok ? { data } : { error: data.error || "Failed to schedule email" });
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const exampleCode = `// TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
// There is no cancel endpoint for a single delayed email.
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Scheduled Email",
    Body: [{ ContentType: "HTML", Content: "<h1>Scheduled Email</h1>" }],
  },
  Options: { TimeOffset: ${delayMinutes} },
});`;

  return (
    <main>
      <PageHeader
        title="Scheduled Sending"
        description="Delay delivery with Options.TimeOffset (minutes from now)."
        sourcePath="src/app/scheduling/page.tsx"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="delay">Delay (minutes)</label>
          <input
            id="delay"
            type="number"
            min={1}
            max={50400}
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(Number(e.target.value))}
            required
          />
          <p className="hint">1 to 50400 minutes (35 days). Scheduled emails cannot be cancelled.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Scheduling..." : "Schedule Email"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Email Scheduled" />

      <h2>Code Example</h2>
      <CodeBlock code={exampleCode} title="src/app/api/send-scheduled/route.ts" />
    </main>
  );
}
