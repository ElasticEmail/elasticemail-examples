<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  sourcePath: { type: String, default: "" },
});
</script>

<template>
  <div class="page-header">
    <NuxtLink to="/" class="muted">&larr; Back to examples</NuxtLink>
    <h1>{{ title }}</h1>
    <p class="muted">{{ description }}</p>
    <a
      v-if="sourcePath"
      :href="`https://github.com/ElasticEmail/elasticemail-examples/blob/main/nuxt-elasticemail-examples/javascript/${sourcePath}`"
      target="_blank"
      rel="noopener noreferrer"
      class="muted"
    >
      View source &rarr;
    </a>
  </div>
</template>
