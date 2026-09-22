<script setup>
useHead({ title: "Elastic Email Examples - Nuxt" });

const examples = [
  {
    category: "Sending Emails",
    items: [
      { title: "Basic Send", description: "Send a simple HTML email", to: "/send-email" },
      { title: "With Attachments", description: "Attach a base64-encoded file", to: "/attachments" },
      { title: "With CID Attachments", description: "Embed inline images using Content-ID", to: "/cid-attachments" },
      { title: "With Templates", description: "Send an Elastic Email template with merge fields", to: "/templates" },
      { title: "Scheduled Send", description: "Delay delivery with TimeOffset", to: "/scheduling" },
      { title: "Prevent Gmail Threading", description: "Unique X-Entity-Ref-ID per email", to: "/prevent-threading" },
    ],
  },
  {
    category: "Receiving Emails and Events",
    items: [
      { title: "Webhooks", description: "Receive Sent, Opened, Clicked, Error events", to: "/webhooks" },
      { title: "Inbound Emails", description: "Receive parsed emails through an inbound route", to: "/inbound" },
    ],
  },
  {
    category: "Subscription",
    items: [{ title: "Double Opt-In", description: "Subscribe with email confirmation", to: "/double-optin" }],
  },
  {
    category: "Management",
    items: [
      { title: "Contacts", description: "Add contacts to a list and list them", to: "/contacts" },
      { title: "Domains", description: "Add a domain and check DNS verification", to: "/domains" },
      { title: "Statistics", description: "Account-wide delivery and engagement counts", to: "/statistics" },
    ],
  },
];
</script>

<template>
  <main class="wide">
    <h1>Elastic Email Examples</h1>
    <p class="muted">
      Examples for sending and managing email with
      <a href="https://elasticemail.com" target="_blank" rel="noopener noreferrer">Elastic Email</a>
      and Nuxt 3.
    </p>

    <div class="card">
      <h3>Quick Setup</h3>
      <ol>
        <li>Copy <code>.env.example</code> to <code>.env</code></li>
        <li>
          Add your API key from
          <a href="https://app.elasticemail.com/marketing/settings/new/manage-api" target="_blank" rel="noopener noreferrer">
            app.elasticemail.com
          </a>
          and set <code>EMAIL_FROM</code> to a verified sender
        </li>
        <li>Run <code>npm run dev</code></li>
      </ol>
    </div>

    <div v-for="section in examples" :key="section.category">
      <h2 class="section-title">{{ section.category }}</h2>
      <div class="grid">
        <NuxtLink v-for="item in section.items" :key="item.to" :to="item.to">
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </NuxtLink>
      </div>
    </div>

    <footer>
      <a href="https://github.com/ElasticEmail/elasticemail-examples" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
      &middot;
      <a href="https://elasticemail.com/developers" target="_blank" rel="noopener noreferrer">Elastic Email Developers</a>
    </footer>
  </main>
</template>
