<script>
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  let to = $state("");
  let loading = $state(false);
  let result = $state(null);

  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi("/api/send-prevent-threading", { to, count: 3 });
    loading = false;
  }

  const exampleCode = `import { randomUUID } from "node:crypto";

  // Gmail groups emails into threads based on subject and Message-ID/References headers.
  // A unique X-Entity-Ref-ID header per email prevents this grouping.
  await emailsApi.emailsTransactionalPost({
    Recipients: { To: [to] },
    Content: {
      From: from,
      Subject: "Order Confirmation", // Same subject every time
      Body: [{ ContentType: "HTML", Content: "<h1>Order Confirmation</h1>" }],
      Headers: { "X-Entity-Ref-ID": randomUUID() },
    },
  });`;
</script>

<svelte:head>
  <title>Prevent Threading - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Prevent Gmail Threading"
    description="Send three emails with the same subject that show up as separate conversations."
    sourcePath="src/routes/api/send-prevent-threading/+server.js"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="to">To</label>
      <input id="to" type="email" bind:value={to} required placeholder="you@gmail.com" />
      <p class="hint">Use a Gmail address to see the effect.</p>
    </div>

    <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send 3 Emails"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Emails Sent" />

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
