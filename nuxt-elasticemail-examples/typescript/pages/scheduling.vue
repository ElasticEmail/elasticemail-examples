<script setup lang="ts">
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Scheduling - Elastic Email Examples" });

const to = ref("");
const delayMinutes = ref(60);
const loading = ref(false);
const result = ref<unknown>(null);
const error = ref<string | null>(null);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/send-scheduled", {
      method: "POST",
      body: { to: to.value, delayMinutes: delayMinutes.value },
    });
  } catch (err) {
    error.value = errorMessage(err, "Failed to schedule email");
  } finally {
    loading.value = false;
  }
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

<template>
  <main>
    <PageHeader
      title="Scheduled Sending"
      description="Delay delivery with Options.TimeOffset (minutes from now)."
      source-path="server/api/send-scheduled.post.ts"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="to">To</label>
        <input id="to" v-model="to" type="email" required placeholder="you@yourdomain.com" />
      </div>

      <div class="field">
        <label for="delay">Delay (minutes)</label>
        <input id="delay" v-model.number="delayMinutes" type="number" min="1" max="50400" required />
        <p class="hint">1 to 50400 minutes (35 days). Scheduled emails cannot be cancelled.</p>
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Scheduling..." : "Schedule Email" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Email Scheduled" />

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
