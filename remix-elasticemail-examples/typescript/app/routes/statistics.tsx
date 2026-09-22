import type { MetaFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const meta: MetaFunction = () => [{ title: "Statistics - Elastic Email Examples" }];

const exampleCode = `// Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
const iso = (d: Date) => d.toISOString().slice(0, 19);
const to = new Date();
const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));
console.log(data.Recipients, data.Delivered, data.Bounced, data.Opened, data.Clicked);`;

export default function Statistics() {
  const fetcher = useFetcher<ApiResult>();
  const loading = fetcher.state !== "idle";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.load(`/api/statistics?days=${Number(form.get("days")) || 30}`);
  };

  return (
    <main>
      <PageHeader
        title="Statistics"
        description="Account-wide sending statistics for a date range."
        sourcePath="app/routes/api.statistics.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="days">Last N days</label>
          <input id="days" name="days" type="number" min={1} max={365} defaultValue={30} required />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Load Statistics"}
        </button>
      </form>

      <ResultDisplay data={fetcher.data} loading={loading} title="Statistics" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
