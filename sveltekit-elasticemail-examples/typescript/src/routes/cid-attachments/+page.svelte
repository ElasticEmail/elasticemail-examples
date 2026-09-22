<script lang="ts">
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  let to = $state("");
  let loading = $state(false);
  let result = $state<{ data?: unknown; error?: string } | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi("/api/send-cid", { to });
    loading = false;
  }

  const exampleCode = `// Elastic Email derives the Content-ID from the attachment file name.
// Reference the attachment Name after "cid:" in the HTML.
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Email with Inline Image",
    Body: [{ ContentType: "HTML", Content: '<img src="cid:logo.png" alt="Logo" />' }],
    Attachments: [{ BinaryContent: pngBase64, Name: "logo.png", ContentType: "image/png" }],
  },
});`;
</script>

<svelte:head>
  <title>CID Attachments - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="CID Attachments"
    description="Embed an inline image referenced by Content-ID."
    sourcePath="src/routes/api/send-cid/+server.ts"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="to">To</label>
      <input id="to" type="email" bind:value={to} required placeholder="you@yourdomain.com" />
      <p class="hint">A 1x1 placeholder PNG is embedded as logo.png.</p>
    </div>

    <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send with Inline Image"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Email Sent" />

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
