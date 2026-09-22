<script setup>
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Templates - Elastic Email Examples" });

const to = ref("");
const firstName = ref("Ann");
const company = ref("Acme");
const loading = ref(false);
const result = ref(null);
const error = ref(null);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/send-template", {
      method: "POST",
      body: { to: to.value, firstName: firstName.value, company: company.value },
    });
  } catch (err) {
    error.value = errorMessage(err, "Failed to send email");
  } finally {
    loading.value = false;
  }
}

const exampleCode = `// Templates are referenced by name. Create it once:
await templatesApi.templatesPost({
  Name: templateName,
  Subject: "Welcome, {firstname}!",
  Body: [{ ContentType: "HTML", Content: "<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>" }],
  TemplateScope: "Personal",
});

// Merge values replace {placeholders} in the template subject and body.
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    TemplateName: templateName,
    Merge: { firstname: "Ann", company: "Acme" },
  },
});`;
</script>

<template>
  <main>
    <PageHeader
      title="Email Templates"
      description="Send a stored Elastic Email template with merge fields. The template is created on first use."
      source-path="server/api/send-template.post.js"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="to">To</label>
        <input id="to" v-model="to" type="email" required placeholder="you@yourdomain.com" />
      </div>

      <div class="field">
        <label for="firstName">First name (merge field)</label>
        <input id="firstName" v-model="firstName" type="text" required />
      </div>

      <div class="field">
        <label for="company">Company (merge field)</label>
        <input id="company" v-model="company" type="text" required />
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Sending..." : "Send Template Email" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Email Sent" />

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
