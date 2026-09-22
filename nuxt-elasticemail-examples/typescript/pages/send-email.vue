<script setup lang="ts">
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Basic Send - Elastic Email Examples" });

const to = ref("");
const subject = ref("Hello from Elastic Email!");
const message = ref("This is a test email sent from the Elastic Email examples app.");
const loading = ref(false);
const result = ref<unknown>(null);
const error = ref<string | null>(null);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/send", {
      method: "POST",
      body: { to: to.value, subject: subject.value, message: message.value },
    });
  } catch (err) {
    error.value = errorMessage(err, "Failed to send email");
  } finally {
    loading.value = false;
  }
}

const exampleCode = `import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: ["you@yourdomain.com"] },
  Content: {
    From: process.env.EMAIL_FROM,
    Subject: "Hello from Elastic Email!",
    Body: [{ ContentType: "HTML", Content: "<p>Hello</p>" }],
  },
});

console.log(data.TransactionID, data.MessageID);`;
</script>

<template>
  <main>
    <PageHeader
      title="Basic Send Email"
      description="Send a simple HTML email through POST /emails/transactional."
      source-path="server/api/send.post.ts"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="to">To</label>
        <input id="to" v-model="to" type="email" required placeholder="you@yourdomain.com" />
        <p class="hint">Elastic Email has no sandbox addresses. Send to yourself.</p>
      </div>

      <div class="field">
        <label for="subject">Subject</label>
        <input id="subject" v-model="subject" type="text" required />
      </div>

      <div class="field">
        <label for="message">Message</label>
        <textarea id="message" v-model="message" rows="4" required />
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Sending..." : "Send Email" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Email Sent" />

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
