"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

export default function StatisticsPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/statistics?days=${days}`);
      const data = await response.json();
      setResult(response.ok ? { data } : { error: data.error || "Failed to load statistics" });
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const exampleCode = `// Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
const iso = (d) => d.toISOString().slice(0, 19);
const to = new Date();
const from = new Date(to.getTime() - ${days} * 24 * 60 * 60 * 1000);

const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));
console.log(data.Recipients, data.Delivered, data.Bounced, data.Opened, data.Clicked);`;

  return (
    <main>
      <PageHeader
        title="Statistics"
        description="Account-wide sending statistics for a date range."
        sourcePath="src/app/statistics/page.jsx"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="days">Last N days</label>
          <input id="days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} required />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Load Statistics"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Statistics" />

      <h2>Code Example</h2>
      <CodeBlock code={exampleCode} title="src/app/api/statistics/route.js" />
    </main>
);
}
