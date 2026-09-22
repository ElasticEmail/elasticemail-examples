<script setup>
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "CID Attachments - Elastic Email Examples" });

const to = ref("");
const loading = ref(false);
const result = ref(null);
const error = ref(null);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/send-cid", { method: "POST", body: { to: to.value } });
  } catch (err) {
    error.value = errorMessage(err, "Failed to send email");
  } finally {
    loading.value = false;
  }
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

<template>
  <main>
    <PageHeader
      title="CID Attachments"
      description="Embed an inline image referenced by Content-ID."
      source-path="server/api/send-cid.post.js"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="to">To</label>
        <input id="to" v-model="to" type="email" required placeholder="you@yourdomain.com" />
        <p class="hint">A 1x1 placeholder PNG is embedded as logo.png.</p>
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Sending..." : "Send with Inline Image" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Email Sent" />

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
