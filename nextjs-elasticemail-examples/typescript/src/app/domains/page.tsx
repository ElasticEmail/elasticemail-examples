"use client";

import { useCallback, useEffect, useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

interface DomainRow {
  Domain?: string;
  Spf?: boolean;
  Dkim?: boolean;
  MX?: boolean;
  DMARC?: boolean;
  TrackingStatus?: string;
  DefaultDomain?: boolean;
}

const flag = (value?: boolean) => (value ? "ok" : "missing");

export default function DomainsPage() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ data?: unknown; error?: string } | null>(null);

  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const loadDomains = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await fetch("/api/domains");
      const data = await response.json();
      if (!response.ok) {
        setListError(data.error || "Failed to load domains");
      } else {
        setDomains(data.domains || []);
      }
    } catch {
      setListError("Network error. Please try again.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult({ data });
        loadDomains();
      } else {
        setResult({ error: data.error || "Failed to add domain" });
      }
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const exampleCode = `// Add the domain (400 "already exists" is fine)
await domainsApi.domainsPost({ Domain: domain });

// Verification flags flip once the DNS records shown in the dashboard are published
const { data } = await domainsApi.domainsByDomainGet(domain);
console.log(data.Spf, data.Dkim, data.MX, data.DMARC, data.TrackingStatus);
console.log("DKIM record to publish:", data.DKIMRecord);`;

  return (
    <main>
      <PageHeader
        title="Domains"
        description="Add a sending domain and check its SPF, DKIM, MX and DMARC verification state."
        sourcePath="src/app/domains/page.tsx"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="domain">Domain</label>
          <input id="domain" type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourdomain.com" />
          <p className="hint">Leave empty to use SENDING_DOMAIN from .env.</p>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Domain"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Domain Status" />

      <h2>Domains on the account</h2>
      {listLoading && <p className="muted">Loading domains...</p>}
      {listError && (
        <div className="result result-error">
          <p>{listError}</p>
        </div>
      )}
      {!listLoading && !listError && domains.length === 0 && <p className="muted">No domains yet.</p>}
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
      <CodeBlock code={exampleCode} title="src/app/api/domains/route.ts" />
    </main>
  );
}
