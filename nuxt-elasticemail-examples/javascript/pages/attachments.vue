<script setup>
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Attachments - Elastic Email Examples" });

const to = ref("");
const loading = ref(false);
const result = ref(null);
const error = ref(null);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/send-attachment", { method: "POST", body: { to: to.value } });
  } catch (err) {
    error.value = errorMessage(err, "Failed to send email");
  } finally {
    loading.value = false;
  }
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

<template>
  <main>
    <PageHeader
      title="Email with Attachments"
      description="Attach a base64-encoded file to a transactional email."
      source-path="server/api/send-attachment.post.js"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="to">To</label>
        <input id="to" v-model="to" type="email" required placeholder="you@yourdomain.com" />
        <p class="hint">A generated sample.txt file is attached.</p>
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Sending..." : "Send with Attachment" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Email Sent" />

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
