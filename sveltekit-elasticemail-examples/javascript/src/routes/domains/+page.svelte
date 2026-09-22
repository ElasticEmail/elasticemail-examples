<script>
  import { onMount } from "svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  const flag = (value) => (value ? "ok" : "missing");

  let domain = $state("");
  let loading = $state(false);
  let result = $state(null);

  let domains = $state([]);
  let listError = $state(null);
  let listLoading = $state(true);

  async function loadDomains() {
    listLoading = true;
    listError = null;
    const { data, error } = await callApi("/api/domains");
    if (error) {
      listError = error;
    } else {
      domains = data.domains || [];
    }
    listLoading = false;
  }

  onMount(loadDomains);

  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi("/api/domains", { domain });
    loading = false;
    if (result.data) loadDomains();
  }

  const exampleCode = `// Add the domain (400 "already exists" is fine)
  await domainsApi.domainsPost({ Domain: domain });

  // Verification flags flip once the DNS records shown in the dashboard are published
  const { data } = await domainsApi.domainsByDomainGet(domain);
  console.log(data.Spf, data.Dkim, data.MX, data.DMARC, data.TrackingStatus);
  console.log("DKIM record to publish:", data.DKIMRecord);`;
</script>

<svelte:head>
  <title>Domains - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Domains"
    description="Add a sending domain and check its SPF, DKIM, MX and DMARC verification state."
    sourcePath="src/routes/api/domains/+server.js"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="domain">Domain</label>
      <input id="domain" type="text" bind:value={domain} placeholder="yourdomain.com" />
      <p class="hint">Leave empty to use SENDING_DOMAIN from .env.</p>
    </div>

    <button type="submit" disabled={loading}>{loading ? "Adding..." : "Add Domain"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Domain Status" />

  <h2>Domains on the account</h2>
  {#if listLoading}
    <p class="muted">Loading domains...</p>
  {:else if listError}
    <div class="result result-error"><p>{listError}</p></div>
  {:else if domains.length === 0}
    <p class="muted">No domains yet.</p>
  {:else}
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
        {#each domains as d (d.Domain)}
          <tr>
            <td>{d.Domain}</td>
            <td>{flag(d.Spf)}</td>
            <td>{flag(d.Dkim)}</td>
            <td>{flag(d.MX)}</td>
            <td>{flag(d.DMARC)}</td>
            <td>{d.TrackingStatus ?? "n/a"}</td>
            <td>{d.DefaultDomain ? "yes" : "no"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
