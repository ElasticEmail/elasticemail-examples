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
    result = await callApi("/api/send-attachment", { to });
    loading = false;
  }

  const exampleCode = `const encoded = Buffer.from("Sample Attachment\\n...").toString("base64");

  await emailsApi.emailsTransactionalPost({
    Recipients: { To: [to] },
    Content: {
      From: from,
      Subject: "Email with Attachment",
      Body: [{ ContentType: "HTML", Content: "<h1>Your attachment is ready</h1>" }],
      // BinaryContent is base64. Total message size limit applies.
      Attachments: [{ BinaryContent: encoded, Name: "sample.txt", ContentType: "text/plain" }],
    },
  });`;
</script>

<svelte:head>
  <title>Attachments - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Email with Attachments"
    description="Attach a base64-encoded file to a transactional email."
    sourcePath="src/routes/api/send-attachment/+server.js"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="to">To</label>
      <input id="to" type="email" bind:value={to} required placeholder="you@yourdomain.com" />
      <p class="hint">A generated sample.txt file is attached.</p>
    </div>

    <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send with Attachment"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Email Sent" />

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
