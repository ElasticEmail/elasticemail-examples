<script setup lang="ts">
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Double Opt-In - Elastic Email Examples" });

const email = ref("");
const name = ref("");
const loading = ref(false);
const result = ref<unknown>(null);
const error = ref<string | null>(null);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/double-optin/subscribe", {
      method: "POST",
      body: { email: email.value, name: name.value },
    });
  } catch (err) {
    error.value = errorMessage(err, "Failed to subscribe");
  } finally {
    loading.value = false;
  }
}

const subscribeCode = `// 1. Store the contact as Transactional (gets the confirmation, no campaigns yet)
await contactsApi.contactsPost([{ Email: email, FirstName: name, Status: "Transactional" }]);

// 2. Send a confirmation link signed with HMAC-SHA256(ELASTICEMAIL_WEBHOOK_TOKEN, email)
const confirmUrl = \`\${publicUrl}/api/double-optin/confirm?email=\${encodeURIComponent(email)}&token=\${hmac(email)}\`;
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [email] },
  Content: { From: from, Subject: "Confirm your subscription", Body: [{ ContentType: "HTML", Content: \`<a href="\${confirmUrl}">Confirm</a>\` }] },
});`;

const confirmCode = `// GET /api/double-optin/confirm?email=...&token=...
// After verifying the HMAC, add the contact to the list
await listsApi.listsByNameContactsPost(listName, { Emails: [email] });`;
</script>

<template>
  <main>
    <PageHeader
      title="Double Opt-In"
      description="Subscribe a contact only after they confirm through an email link."
      source-path="server/api/double-optin/subscribe.post.ts"
    />

    <div class="card">
      <h3>How it works</h3>
      <ol>
        <li>User submits their email address</li>
        <li>Contact is created with <code>Status: "Transactional"</code> and is not on the list yet</li>
        <li>A confirmation email with an HMAC-signed link is sent</li>
        <li><code>/api/double-optin/confirm</code> validates the token and calls <code>listsByNameContactsPost</code></li>
        <li>Alternative: point an Elastic Email webhook for Clicked events at <code>/api/double-optin/webhook</code></li>
      </ol>
    </div>

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required placeholder="you@yourdomain.com" />
      </div>

      <div class="field">
        <label for="name">Name (optional)</label>
        <input id="name" v-model="name" type="text" placeholder="Ann Example" />
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Subscribing..." : "Subscribe" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Confirmation Sent" />

    <h2>Subscribe</h2>
    <div class="code-block"><pre><code>{{ subscribeCode }}</code></pre></div>

    <h2>Confirm</h2>
    <div class="code-block"><pre><code>{{ confirmCode }}</code></pre></div>
  </main>
</template>
