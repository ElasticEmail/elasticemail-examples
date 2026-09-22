<script lang="ts">
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  let to = $state("");
  let subject = $state("Hello from Elastic Email!");
  let message = $state("This is a test email sent from the Elastic Email examples app.");
  let loading = $state(false);
  let result = $state<{ data?: unknown; error?: string } | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi("/api/send", { to, subject, message });
    loading = false;
  }

  const exampleCode = `import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: ["you@yourdomain.com"] },
  Content: {
    From: env.EMAIL_FROM,
    Subject: "Hello from Elastic Email!",
    Body: [{ ContentType: "HTML", Content: "<p>Hello</p>" }],
  },
});

console.log(data.TransactionID, data.MessageID);`;
</script>

<svelte:head>
  <title>Basic Send - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Basic Send Email"
    description="Send a simple HTML email through POST /emails/transactional."
    sourcePath="src/routes/api/send/+server.ts"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="to">To</label>
      <input id="to" type="email" bind:value={to} required placeholder="you@yourdomain.com" />
      <p class="hint">Elastic Email has no sandbox addresses. Send to yourself.</p>
    </div>

    <div class="field">
      <label for="subject">Subject</label>
      <input id="subject" type="text" bind:value={subject} required />
    </div>

    <div class="field">
      <label for="message">Message</label>
      <textarea id="message" bind:value={message} rows="4" required></textarea>
    </div>

    <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Email"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Email Sent" />

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
