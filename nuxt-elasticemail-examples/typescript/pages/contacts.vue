<script setup lang="ts">
import { errorMessage } from "~/utils/errorMessage";

useHead({ title: "Contacts - Elastic Email Examples" });

interface Contact {
  Email?: string;
  FirstName?: string;
  LastName?: string;
  Status?: string;
  DateAdded?: string;
}

interface ContactList {
  list?: string;
  contacts?: Contact[];
}

const email = ref("");
const firstName = ref("");
const lastName = ref("");
const loading = ref(false);
const result = ref<unknown>(null);
const error = ref<string | null>(null);

const contacts = ref<Contact[]>([]);
const listName = ref("");
const listError = ref<string | null>(null);
const listLoading = ref(true);

async function loadContacts() {
  listLoading.value = true;
  listError.value = null;
  try {
    const data = await $fetch<ContactList>("/api/contacts");
    contacts.value = data.contacts || [];
    listName.value = data.list || "";
  } catch (err) {
    listError.value = errorMessage(err, "Failed to load contacts");
  } finally {
    listLoading.value = false;
  }
}

onMounted(loadContacts);

async function submit() {
  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    result.value = await $fetch("/api/contacts", {
      method: "POST",
      body: { email: email.value, firstName: firstName.value, lastName: lastName.value },
    });
    await loadContacts();
  } catch (err) {
    error.value = errorMessage(err, "Failed to add contact");
  } finally {
    loading.value = false;
  }
}

const exampleCode = `// Lists are addressed by name. Create it once (400 "already exists" is fine).
await listsApi.listsPost({ ListName: listName, AllowUnsubscribe: true });

// Add a contact and put it on the list in one call
await contactsApi.contactsPost(
  [{ Email: email, FirstName: firstName, LastName: lastName, Status: "Active" }],
  [listName],
);

// Read contacts on the list
const { data } = await listsApi.listsByListnameContactsGet(listName, 50, 0);`;
</script>

<template>
  <main>
    <PageHeader
      title="Contacts"
      description="Add contacts to the list from ELASTICEMAIL_LIST_NAME and list them."
      source-path="server/api/contacts.post.ts"
    />

    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required placeholder="you@yourdomain.com" />
      </div>

      <div class="field">
        <label for="firstName">First name</label>
        <input id="firstName" v-model="firstName" type="text" />
      </div>

      <div class="field">
        <label for="lastName">Last name</label>
        <input id="lastName" v-model="lastName" type="text" />
      </div>

      <button type="submit" :disabled="loading">{{ loading ? "Adding..." : "Add Contact" }}</button>
    </form>

    <ResultDisplay :data="result" :error="error" :loading="loading" title="Contact Added" />

    <h2>Contacts in {{ listName || "list" }}</h2>
    <p v-if="listLoading" class="muted">Loading contacts...</p>
    <div v-else-if="listError" class="result result-error">
      <p>{{ listError }}</p>
    </div>
    <p v-else-if="contacts.length === 0" class="muted">No contacts yet.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Status</th>
          <th>Added</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in contacts" :key="c.Email">
          <td>{{ c.Email }}</td>
          <td>{{ [c.FirstName, c.LastName].filter(Boolean).join(" ") }}</td>
          <td>{{ c.Status }}</td>
          <td>{{ c.DateAdded ? new Date(c.DateAdded).toLocaleDateString() : "" }}</td>
        </tr>
      </tbody>
    </table>

    <h2>Code Example</h2>
    <div class="code-block"><pre><code>{{ exampleCode }}</code></pre></div>
  </main>
</template>
