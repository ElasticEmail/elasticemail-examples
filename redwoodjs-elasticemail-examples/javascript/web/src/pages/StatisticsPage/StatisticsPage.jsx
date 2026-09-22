import { Metadata } from "@redwoodjs/web";
import { useState } from "react";
import { PageHeader } from "src/components/PageHeader";
import { ResultDisplay } from "src/components/ResultDisplay";

const exampleCode = `// Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
const iso = (d) => d.toISOString().slice(0, 19);
const to = new Date();
const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));
console.log(data.Recipients, data.Delivered, data.Bounced, data.Opened, data.Clicked);`;

const StatisticsPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `/.redwood/functions/statistics?${new URLSearchParams({ days: String(form.get("days") ?? "") })}`,
      );
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
      <Metadata title="Statistics" description="Account-wide sending statistics for a date range." />

      <PageHeader
        title="Statistics"
        description="Account-wide sending statistics for a date range."
        sourcePath="api/src/functions/statistics.ts"
      />

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
};

export default StatisticsPage;
