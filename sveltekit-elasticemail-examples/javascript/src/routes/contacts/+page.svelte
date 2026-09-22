<script>
  import { onMount } from "svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ResultDisplay from "$lib/components/ResultDisplay.svelte";
  import { callApi } from "$lib/api";

  let email = $state("");
  let firstName = $state("");
  let lastName = $state("");
  let loading = $state(false);
  let result = $state(null);

  let contacts = $state([]);
  let listName = $state("");
  let listError = $state(null);
  let listLoading = $state(true);

  async function loadContacts() {
    listLoading = true;
    listError = null;
    const { data, error } = await callApi("/api/contacts");
    if (error) {
      listError = error;
    } else {
      const list = data;
      contacts = list.contacts || [];
      listName = list.list || "";
    }
    listLoading = false;
  }

  onMount(loadContacts);

  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    result = null;
    result = await callApi("/api/contacts", { email, firstName, lastName });
    loading = false;
    if (result.data) loadContacts();
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

<svelte:head>
  <title>Contacts - Elastic Email Examples</title>
</svelte:head>

<main>
  <PageHeader
    title="Contacts"
    description="Add contacts to the list from ELASTICEMAIL_LIST_NAME and list them."
    sourcePath="src/routes/api/contacts/+server.js"
  />

  <form onsubmit={handleSubmit} class="form">
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required placeholder="you@yourdomain.com" />
    </div>

    <div class="field">
      <label for="firstName">First name</label>
      <input id="firstName" type="text" bind:value={firstName} />
    </div>

    <div class="field">
      <label for="lastName">Last name</label>
      <input id="lastName" type="text" bind:value={lastName} />
    </div>

    <button type="submit" disabled={loading}>{loading ? "Adding..." : "Add Contact"}</button>
  </form>

  <ResultDisplay data={result?.data} error={result?.error} {loading} title="Contact Added" />

  <h2>Contacts in {listName || "list"}</h2>
  {#if listLoading}
    <p class="muted">Loading contacts...</p>
  {:else if listError}
    <div class="result result-error"><p>{listError}</p></div>
  {:else if contacts.length === 0}
    <p class="muted">No contacts yet.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Status</th>
          <th>Added</th>
        </tr>
      </thead>
      <tbody>
        {#each contacts as c (c.Email)}
          <tr>
            <td>{c.Email}</td>
            <td>{[c.FirstName, c.LastName].filter(Boolean).join(" ")}</td>
            <td>{c.Status}</td>
            <td>{c.DateAdded ? new Date(c.DateAdded).toLocaleDateString() : ""}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <h2>Code Example</h2>
  <div class="code-block"><pre><code>{exampleCode}</code></pre></div>
</main>
