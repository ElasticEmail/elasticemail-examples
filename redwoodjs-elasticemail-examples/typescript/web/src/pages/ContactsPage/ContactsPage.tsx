import { Metadata } from "@redwoodjs/web";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "src/components/PageHeader";
import { ResultDisplay, type ApiResult } from "src/components/ResultDisplay";

interface Contact {
  Email?: string;
  FirstName?: string;
  LastName?: string;
  Status?: string;
  DateAdded?: string;
}

interface ContactList extends ApiResult {
  list?: string;
  contacts?: Contact[];
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

const ContactsPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [list, setList] = useState<ContactList | null>(null);

  const loadList = () =>
    fetch("/.redwood/functions/contacts")
      .then((res) => res.json())
      .then(setList)
      .catch((err: Error) => setList({ error: err.message }));

  useEffect(() => {
    loadList();
  }, []);

  const items = list?.contacts ?? [];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/.redwood/functions/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          firstName: String(form.get("firstName") ?? ""),
          lastName: String(form.get("lastName") ?? ""),
        }),
      });
      const data: ApiResult = await res.json();
      setResult(data);
      if (data.success) loadList();
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <Metadata title="Contacts" description="Add contacts to the list from ELASTICEMAIL_LIST_NAME and list them." />

      <PageHeader title="Contacts" description="Add contacts to the list from ELASTICEMAIL_LIST_NAME and list them." sourcePath="api/src/functions/contacts.ts" />

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
};

export default ContactsPage;
