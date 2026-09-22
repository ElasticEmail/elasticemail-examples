<script>
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  let days = $state(30);
  let loading = $state(false);
  let result = $state(null);

  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi(`/api/statistics?days=${days}`);
    loading = false;
  }

  const exampleCode = `// Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
  const iso = (d) => d.toISOString().slice(0, 19);
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));
  console.log(data.Recipients, data.Delivered, data.Bounced, data.Opened, data.Clicked);`;
</script>

<svelte:head>
  <title>Statistics - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Statistics"
    description="Account-wide sending statistics for a date range."
    sourcePath="src/routes/api/statistics/+server.js"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="days">Last N days</label>
      <input id="days" type="number" min="1" max="365" bind:value={days} required />
    </div>

    <button type="submit" disabled={loading}>{loading ? "Loading..." : "Load Statistics"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Statistics" />

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
