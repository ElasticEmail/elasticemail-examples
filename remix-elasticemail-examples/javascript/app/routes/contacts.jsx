import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay } from "../components/ResultDisplay";

export const meta = () => [{ title: "Contacts - Elastic Email Examples" }];

const exampleCode = `// Lists are addressed by name. Create it once (400 "already exists" is fine).
await listsApi.listsPost({ ListName: listName, AllowUnsubscribe: true });

// Add a contact and put it on the list in one call
await contactsApi.contactsPost(
  [{ Email: email, FirstName: firstName, LastName: lastName, Status: "Active" }],
  [listName],
);

// Read contacts on the list
const { data } = await listsApi.listsByListnameContactsGet(listName, 50, 0);`;

export default function Contacts() {
  const fetcher = useFetcher();
  const list = useFetcher();
  const { load } = list;
  const loading = fetcher.state !== "idle";

  useEffect(() => {
    load("/api/contacts");
  }, [load]);

  // Refresh the table after a contact was added
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) load("/api/contacts");
  }, [fetcher.state, fetcher.data, load]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      {
        email: String(form.get("email")),
        firstName: String(form.get("firstName")),
        lastName: String(form.get("lastName")),
      },
      { method: "post", action: "/api/contacts", encType: "application/json" },
    );
  };

  const contacts = list.data?.contacts ?? [];

  return (
    <main>
      <PageHeader
        title="Contacts"
        description="Add contacts to the list from ELASTICEMAIL_LIST_NAME and list them."
        sourcePath="app/routes/api.contacts.js"
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

      <ResultDisplay data={fetcher.data} loading={loading} title="Contact Added" />

      <h2>Contacts in {list.data?.list || "list"}</h2>
      {list.state !== "idle" && <p className="muted">Loading contacts...</p>}
      {list.data?.error && (
        <div className="result result-error">
          <p>{list.data.error}</p>
        </div>
      )}
      {list.state === "idle" && list.data && !list.data.error && contacts.length === 0 && (
        <p className="muted">No contacts yet.</p>
      )}
      {contacts.length > 0 && (
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
            {contacts.map((c) => (
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
