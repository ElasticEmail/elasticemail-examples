<script>
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  let to = $state("");
  let delayMinutes = $state(60);
  let loading = $state(false);
  let result = $state(null);

  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi("/api/send-scheduled", { to, delayMinutes });
    loading = false;
  }

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
</script>

<svelte:head>
  <title>Scheduling - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Scheduled Sending"
    description="Delay delivery with Options.TimeOffset (minutes from now)."
    sourcePath="src/routes/api/send-scheduled/+server.js"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="to">To</label>
      <input id="to" type="email" bind:value={to} required placeholder="you@yourdomain.com" />
    </div>

    <div class="field">
      <label for="delay">Delay (minutes)</label>
      <input id="delay" type="number" min="1" max="50400" bind:value={delayMinutes} required />
      <p class="hint">1 to 50400 minutes (35 days). Scheduled emails cannot be cancelled.</p>
    </div>

    <button type="submit" disabled={loading}>{loading ? "Scheduling..." : "Schedule Email"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Email Scheduled" />

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
