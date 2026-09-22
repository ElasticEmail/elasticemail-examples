<script setup>
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Statistics - Elastic Email Examples" });

const days = ref(30);
const loading = ref(false);
const result = ref(null);
const error = ref(null);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/statistics", { query: { days: days.value } });
  } catch (err) {
    error.value = errorMessage(err, "Failed to load statistics");
  } finally {
    loading.value = false;
  }
}

const exampleCode = `// Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
const iso = ((d)) => d.toISOString().slice(0, 19);
const to = new Date();
const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));
console.log(data.Recipients, data.Delivered, data.Bounced, data.Opened, data.Clicked);`;
</script>

<template>
  <main>
    <PageHeader
      title="Statistics"
      description="Account-wide sending statistics for a date range."
      source-path="server/api/statistics.get.js"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="days">Last N days</label>
        <input id="days" v-model.number="days" type="number" min="1" max="365" required />
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Loading..." : "Load Statistics" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Statistics" />

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
