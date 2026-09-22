import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const Route = createFileRoute("/statistics")({
  component: StatisticsPage,
  head: () => ({ meta: [{ title: "Statistics - Elastic Email Examples" }] }),
});

const exampleCode = `// Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
const iso = (d: Date) => d.toISOString().slice(0, 19);
const to = new Date();
const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));
console.log(data.Recipients, data.Delivered, data.Bounced, data.Opened, data.Clicked);`;

function StatisticsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/statistics?${new URLSearchParams({ days: String(form.get("days") ?? "") })}`);
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
      <PageHeader title="Statistics" description="Account-wide sending statistics for a date range." sourcePath="src/routes/api/statistics.ts" />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="days">Last N days</label>
          <input id="days" name="days" type="number" required min={1} max={365} defaultValue={30} />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Load Statistics"}
        </button>
      </form>

      <ResultDisplay data={result} loading={loading} title="Statistics" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
