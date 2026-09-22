export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
  css: ["~/assets/main.css"],
  app: {
    head: {
      title: "Elastic Email Examples - Nuxt + JavaScript",
      meta: [{ name: "description", content: "Examples for sending and managing email with Elastic Email and Nuxt" }],
    },
  },
});
