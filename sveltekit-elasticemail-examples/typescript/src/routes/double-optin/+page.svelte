<script lang="ts">
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  let email = $state("");
  let name = $state("");
  let loading = $state(false);
  let result = $state<{ data?: unknown; error?: string } | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi("/api/double-optin/subscribe", { email, name });
    loading = false;
  }

  const subscribeCode = `// 1. Store the contact as Transactional (gets the confirmation, no campaigns yet)
await contactsApi.contactsPost([{ Email: email, FirstName: name, Status: "Transactional" }]);

// 2. Send a confirmation link signed with HMAC-SHA256(ELASTICEMAIL_WEBHOOK_TOKEN, email)
const confirmUrl = \`\${publicUrl}/api/double-optin/confirm?email=\${encodeURIComponent(email)}&token=\${hmac(email)}\`;
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [email] },
  Content: { From: from, Subject: "Confirm your subscription", Body: [{ ContentType: "HTML", Content: \`<a href="\${confirmUrl}">Confirm</a>\` }] },
});`;

  const confirmCode = `// GET /api/double-optin/confirm?email=...&token=...
// After verifying the HMAC, add the contact to the list
await listsApi.listsByNameContactsPost(listName, { Emails: [email] });`;
</script>

<svelte:head>
  <title>Double Opt-In - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Double Opt-In"
    description="Subscribe a contact only after they confirm through an email link."
    sourcePath="src/routes/api/double-optin/subscribe/+server.ts"
  />

  <div class="card">
    <h3>How it works</h3>
    <ol>
      <li>User submits their email address</li>
      <li>Contact is created with <code>Status: "Transactional"</code> and is not on the list yet</li>
      <li>A confirmation email with an HMAC-signed link is sent</li>
      <li><code>/api/double-optin/confirm</code> validates the token and calls <code>listsByNameContactsPost</code></li>
      <li>Alternative: point an Elastic Email webhook for Clicked events at <code>/api/double-optin/webhook</code></li>
    </ol>
  </div>

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required placeholder="you@yourdomain.com" />
    </div>

    <div class="field">
      <label for="name">Name (optional)</label>
      <input id="name" type="text" bind:value={name} placeholder="Ann Example" />
    </div>

    <button type="submit" disabled={loading}>{loading ? "Subscribing..." : "Subscribe"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Confirmation Sent" />

  <h2>Subscribe</h2>
  <div class="code-block"><pre><code>{subscribeCode}</code></pre></div>

  <h2>Confirm</h2>
  <div class="code-block"><pre><code>{confirmCode}</code></pre></div>
</main>
