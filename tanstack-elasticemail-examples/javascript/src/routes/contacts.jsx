import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay } from "../components/ResultDisplay";

export const Route = createFileRoute("/contacts")({
  component: ContactsPage,
  head: () => ({ meta: [{ title: "Contacts - Elastic Email Examples" }] }),
});

const exampleCode = `// Lists are addressed by name. Create it once (400 "already exists" is fine).
await listsApi.listsPost({ ListName: listName, AllowUnsubscribe: true });

// Add a contact and put it on the list in one call
await contactsApi.contactsPost(
  [{ Email: email, FirstName: firstName, LastName: lastName, Status: "Active" }],
  [listName],
);

// Read contacts on the list
const { data } = await listsApi.listsByListnameContactsGet(listName, 50, 0);`;

function ContactsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [list, setList] = useState(null);

  const loadList = () =>
    fetch("/api/contacts")
      .then((res) => res.json())
      .then(setList)
      .catch((err) => setList({ error: err.message }));

  useEffect(() => {
    loadList();
  }, []);

  const items = list?.contacts ?? [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          firstName: String(form.get("firstName") ?? ""),
          lastName: String(form.get("lastName") ?? ""),
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) loadList();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <PageHeader
        title="Contacts"
        description="Add contacts to the list from ELASTICEMAIL_LIST_NAME and list them."
        sourcePath="src/routes/api/contacts.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="firstName">First name</label>
          <input id="firstName" name="firstName" type="text" />
        </div>

        <div className="field">
          <label htmlFor="lastName">Last name</label>
          <input id="lastName" name="lastName" type="text" />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Contact"}
        </button>
      </form>

      <ResultDisplay data={result} loading={loading} title="Contact Added" />

      <h2>Contacts in {list?.list || "list"}</h2>
      {!list && <p className="muted">Loading contacts...</p>}
      {list?.error && (
        <div className="result result-error">
          <p>{list.error}</p>
        </div>
      )}
      {list && !list.error && items.length === 0 && <p className="muted">No contacts yet.</p>}
      {items.length > 0 && (
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
            {items.map((c) => (
              <tr key={c.Email}>
                <td>{c.Email}</td>
                <td>{[c.FirstName, c.LastName].filter(Boolean).join(" ")}</td>
                <td>{c.Status}</td>
                <td>{c.DateAdded ? new Date(c.DateAdded).toLocaleDateString() : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
