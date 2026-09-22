import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay } from "../components/ResultDisplay";

export const Route = createFileRoute("/scheduling")({
  component: SchedulingPage,
  head: () => ({ meta: [{ title: "Scheduling - Elastic Email Examples" }] }),
});

const exampleCode = `// TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
// There is no cancel endpoint for a single delayed email.
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Scheduled Email",
    Body: [{ ContentType: "HTML", Content: "<h1>Scheduled Email</h1>" }],
  },
  Options: { TimeOffset: 60 },
});`;

function SchedulingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/send-scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: String(form.get("to") ?? ""),
          delayMinutes: Number(form.get("delayMinutes")),
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
        title="Scheduled Sending"
        description="Delay delivery with Options.TimeOffset (minutes from now)."
        sourcePath="src/routes/api/send-scheduled.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="delayMinutes">Delay (minutes)</label>
          <input id="delayMinutes" name="delayMinutes" type="number" required min={1} max={50400} defaultValue={60} />
          <p className="hint">1 to 50400 minutes (35 days). Scheduled emails cannot be cancelled.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Scheduling..." : "Schedule Email"}
        </button>
      </form>

      <ResultDisplay data={result} loading={loading} title="Email Scheduled" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
