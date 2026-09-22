<script setup lang="ts">
withDefaults(
  defineProps<{
    data?: unknown;
    error?: string | null;
    loading?: boolean;
    title?: string;
  }>(),
  { error: null, loading: false, title: "Result" },
);
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
