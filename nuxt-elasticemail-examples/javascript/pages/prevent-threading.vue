<script setup>
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Prevent Threading - Elastic Email Examples" });

const to = ref("");
const loading = ref(false);
const result = ref(null);
const error = ref(null);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/send-prevent-threading", { method: "POST", body: { to: to.value, count: 3 } });
  } catch (err) {
    error.value = errorMessage(err, "Failed to send emails");
  } finally {
    loading.value = false;
  }
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

<template>
  <main>
    <PageHeader
      title="Prevent Gmail Threading"
      description="Send three emails with the same subject that show up as separate conversations."
      source-path="server/api/send-prevent-threading.post.js"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="to">To</label>
        <input id="to" v-model="to" type="email" required placeholder="you@gmail.com" />
        <p class="hint">Use a Gmail address to see the effect.</p>
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Sending..." : "Send 3 Emails" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Emails Sent" />

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
