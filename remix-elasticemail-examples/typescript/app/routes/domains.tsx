import { useEffect } from "react";
import type { MetaFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const meta: MetaFunction = () => [{ title: "Domains - Elastic Email Examples" }];

interface DomainRow {
  Domain?: string;
  Spf?: boolean;
  Dkim?: boolean;
  MX?: boolean;
  DMARC?: boolean;
  TrackingStatus?: string;
  DefaultDomain?: boolean;
}

interface DomainList extends ApiResult {
  domains?: DomainRow[];
}

const flag = (value?: boolean) => (value ? "ok" : "missing");

const exampleCode = `// Add the domain (400 "already exists" is fine)
await domainsApi.domainsPost({ Domain: domain });

// Verification flags flip once the DNS records shown in the dashboard are published
const { data } = await domainsApi.domainsByDomainGet(domain);
console.log(data.Spf, data.Dkim, data.MX, data.DMARC, data.TrackingStatus);
console.log("DKIM record to publish:", data.DKIMRecord);`;

export default function Domains() {
  const fetcher = useFetcher<ApiResult>();
  const list = useFetcher<DomainList>();
  const { load } = list;
  const loading = fetcher.state !== "idle";

  useEffect(() => {
    load("/api/domains");
  }, [load]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) load("/api/domains");
  }, [fetcher.state, fetcher.data, load]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      { domain: String(form.get("domain") ?? "") },
      { method: "post", action: "/api/domains", encType: "application/json" },
    );
  };

  const domains = list.data?.domains ?? [];

  return (
    <main>
      <PageHeader
        title="Domains"
        description="Add a sending domain and check its SPF, DKIM, MX and DMARC verification state."
        sourcePath="app/routes/api.domains.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="domain">Domain</label>
          <input id="domain" name="domain" type="text" placeholder="yourdomain.com" />
          <p className="hint">Leave empty to use SENDING_DOMAIN from .env.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Domain"}
        </button>
      </form>

      <ResultDisplay data={fetcher.data} loading={loading} title="Domain Status" />

      <h2>Domains on the account</h2>
      {list.state !== "idle" && <p className="muted">Loading domains...</p>}
      {list.data?.error && (
        <div className="result result-error">
          <p>{list.data.error}</p>
        </div>
      )}
      {list.state === "idle" && list.data && !list.data.error && domains.length === 0 && (
        <p className="muted">No domains yet.</p>
      )}
      {domains.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>SPF</th>
              <th>DKIM</th>
              <th>MX</th>
              <th>DMARC</th>
              <th>Tracking</th>
              <th>Default</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.Domain}>
                <td>{d.Domain}</td>
                <td>{flag(d.Spf)}</td>
                <td>{flag(d.Dkim)}</td>
                <td>{flag(d.MX)}</td>
                <td>{flag(d.DMARC)}</td>
                <td>{d.TrackingStatus ?? "n/a"}</td>
                <td>{d.DefaultDomain ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
