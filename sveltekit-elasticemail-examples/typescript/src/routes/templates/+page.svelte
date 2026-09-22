<script lang="ts">
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  let to = $state("");
  let firstName = $state("Ann");
  let company = $state("Acme");
  let loading = $state(false);
  let result = $state<{ data?: unknown; error?: string } | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi("/api/send-template", { to, firstName, company });
    loading = false;
  }

  const exampleCode = `// Templates are referenced by name. Create it once:
await templatesApi.templatesPost({
  Name: templateName,
  Subject: "Welcome, {firstname}!",
  Body: [{ ContentType: "HTML", Content: "<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>" }],
  TemplateScope: "Personal",
});

// Merge values replace {placeholders} in the template subject and body.
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    TemplateName: templateName,
    Merge: { firstname: "Ann", company: "Acme" },
  },
});`;
</script>

<svelte:head>
  <title>Templates - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Email Templates"
    description="Send a stored Elastic Email template with merge fields. The template is created on first use."
    sourcePath="src/routes/api/send-template/+server.ts"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="to">To</label>
      <input id="to" type="email" bind:value={to} required placeholder="you@yourdomain.com" />
    </div>

    <div class="field">
      <label for="firstName">First name (merge field)</label>
      <input id="firstName" type="text" bind:value={firstName} required />
    </div>

    <div class="field">
      <label for="company">Company (merge field)</label>
      <input id="company" type="text" bind:value={company} required />
    </div>

    <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Template Email"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Email Sent" />

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
