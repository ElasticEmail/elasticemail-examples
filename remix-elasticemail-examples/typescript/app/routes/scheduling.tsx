import type { MetaFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const meta: MetaFunction = () => [{ title: "Scheduling - Elastic Email Examples" }];

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

export default function Scheduling() {
  const fetcher = useFetcher<ApiResult>();
  const loading = fetcher.state !== "idle";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      { to: String(form.get("to")), delayMinutes: Number(form.get("delayMinutes")) },
      { method: "post", action: "/api/send-scheduled", encType: "application/json" },
    );
  };

  return (
    <main>
      <PageHeader
        title="Scheduled Sending"
        description="Delay delivery with Options.TimeOffset (minutes from now)."
        sourcePath="app/routes/api.send-scheduled.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="delayMinutes">Delay (minutes)</label>
          <input id="delayMinutes" name="delayMinutes" type="number" min={1} max={50400} defaultValue={60} required />
          <p className="hint">1 to 50400 minutes (35 days). Scheduled emails cannot be cancelled.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Scheduling..." : "Schedule Email"}
        </button>
      </form>

      <ResultDisplay data={fetcher.data} loading={loading} title="Email Scheduled" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
