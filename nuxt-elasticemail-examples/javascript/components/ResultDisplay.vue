<script setup>
defineProps({
  data: { type: null, default: null },
  error: { type: String, default: null },
  loading: { type: Boolean, default: false },
  title: { type: String, default: "Result" },
});
</script>

<template>
  <div v-if="loading" class="result">
    <p class="muted">Working...</p>
  </div>
  <div v-else-if="error" class="result result-error">
    <h3>Error</h3>
    <p>{{ error }}</p>
  </div>
  <div v-else-if="data" class="result result-success">
    <h3>{{ title }}</h3>
    <pre>{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>
