<script setup>
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Domains - Elastic Email Examples" });

const flag = (value) => (value ? "ok" : "missing");

const domain = ref("");
const loading = ref(false);
const result = ref(null);
const error = ref(null);

const domains = ref([]);
const listError = ref(null);
const listLoading = ref(true);

async function loadDomains() {
  listLoading.value = true;
  listError.value = null;
  try {
    const data = await $fetch("/api/domains");
    domains.value = data.domains || [];
  } catch (err) {
    listError.value = errorMessage(err, "Failed to load domains");
  } finally {
    listLoading.value = false;
  }
}

onMounted(loadDomains);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/domains", { method: "POST", body: { domain: domain.value } });
    await loadDomains();
  } catch (err) {
    error.value = errorMessage(err, "Failed to add domain");
  } finally {
    loading.value = false;
  }
}

const exampleCode = `// Add the domain (400 "already exists" is fine)
await domainsApi.domainsPost({ Domain: domain });

// Verification flags flip once the DNS records shown in the dashboard are published
const { data } = await domainsApi.domainsByDomainGet(domain);
console.log(data.Spf, data.Dkim, data.MX, data.DMARC, data.TrackingStatus);
console.log("DKIM record to publish:", data.DKIMRecord);`;
</script>

<template>
  <main>
    <PageHeader
      title="Domains"
      description="Add a sending domain and check its SPF, DKIM, MX and DMARC verification state."
      source-path="server/api/domains.post.js"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="domain">Domain</label>
        <input id="domain" v-model="domain" type="text" placeholder="yourdomain.com" />
        <p class="hint">Leave empty to use SENDING_DOMAIN from .env.</p>
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Adding..." : "Add Domain" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Domain Status" />

    <h2>Domains on the account</h2>
    <p v-if="listLoading" class="muted">Loading domains...</p>
    <div v-else-if="listError" class="result result-error">
      <p>{{ listError }}</p>
    </div>
    <p v-else-if="domains.length === 0" class="muted">No domains yet.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Domain</th>
          <th>SPF</th>
          <th>DKIM</th>
          <th>MX</th>
          <th>DMARC</th>
          <th>Tracking</th>
          <th>Default</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in domains" :key="d.Domain">
          <td>{{ d.Domain }}</td>
          <td>{{ flag(d.Spf) }}</td>
          <td>{{ flag(d.Dkim) }}</td>
          <td>{{ flag(d.MX) }}</td>
          <td>{{ flag(d.DMARC) }}</td>
          <td>{{ d.TrackingStatus ?? "n/a" }}</td>
          <td>{{ d.DefaultDomain ? "yes" : "no" }}</td>
        </tr>
      </tbody>
    </table>

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
