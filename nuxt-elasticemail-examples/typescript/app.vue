<script setup lang="ts">
const nav = [
  { to: "/send-email", label: "Send" },
  { to: "/attachments", label: "Attachments" },
  { to: "/templates", label: "Templates" },
  { to: "/scheduling", label: "Scheduling" },
  { to: "/contacts", label: "Contacts" },
  { to: "/domains", label: "Domains" },
  { to: "/statistics", label: "Statistics" },
  { to: "/webhooks", label: "Webhooks" },
  { to: "/inbound", label: "Inbound" },
  { to: "/double-optin", label: "Double opt-in" },
];
</script>

<template>
  <div>
    <nav class="nav">
      <NuxtLink to="/" class="nav-brand">Elastic Email Examples</NuxtLink>
      <div class="nav-links">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
      </div>
    </nav>
    <NuxtPage />
  </div>
</template>
