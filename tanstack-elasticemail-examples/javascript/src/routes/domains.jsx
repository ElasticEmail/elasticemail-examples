import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay } from "../components/ResultDisplay";

export const Route = createFileRoute("/domains")({
  component: DomainsPage,
  head: () => ({ meta: [{ title: "Domains - Elastic Email Examples" }] }),
});

const flag = (value) => (value ? "ok" : "missing");

const exampleCode = `// Add the domain (400 "already exists" is fine)
await domainsApi.domainsPost({ Domain: domain });

// Verification flags flip once the DNS records shown in the dashboard are published
const { data } = await domainsApi.domainsByDomainGet(domain);
console.log(data.Spf, data.Dkim, data.MX, data.DMARC, data.TrackingStatus);
console.log("DKIM record to publish:", data.DKIMRecord);`;

function DomainsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [list, setList] = useState(null);

  const loadList = () =>
    fetch("/api/domains")
      .then((res) => res.json())
      .then(setList)
      .catch((err) => setList({ error: err.message }));

  useEffect(() => {
    loadList();
  }, []);

  const items = list?.domains ?? [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: String(form.get("domain") ?? ""),
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) loadList();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <PageHeader
        title="Domains"
        description="Add a sending domain and check its SPF, DKIM, MX and DMARC verification state."
        sourcePath="src/routes/api/domains.ts"
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

      <ResultDisplay data={result} loading={loading} title="Domain Status" />

      <h2>Domains on the account</h2>
      {!list && <p className="muted">Loading domains...</p>}
      {list?.error && (
        <div className="result result-error">
          <p>{list.error}</p>
        </div>
      )}
      {list && !list.error && items.length === 0 && <p className="muted">No domains yet.</p>}
      {items.length > 0 && (
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
            {items.map((d) => (
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
