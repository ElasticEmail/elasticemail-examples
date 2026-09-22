"use client";

import { useCallback, useEffect, useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

export default function ContactsPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [contacts, setContacts] = useState([]);
  const [listName, setListName] = useState("");
  const [listError, setListError] = useState(null);
  const [listLoading, setListLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await fetch("/api/contacts");
      const data = await response.json();
      if (!response.ok) {
        setListError(data.error || "Failed to load contacts");
      } else {
        setContacts(data.contacts || []);
        setListName(data.list || "");
      }
    } catch {
      setListError("Network error. Please try again.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult({ data });
        loadContacts();
      } else {
        setResult({ error: data.error || "Failed to add contact" });
      }
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const exampleCode = `// Lists are addressed by name. Create it once (400 "already exists" is fine).
await listsApi.listsPost({ ListName: listName, AllowUnsubscribe: true });

// Add a contact and put it on the list in one call
await contactsApi.contactsPost(
  [{ Email: email, FirstName: firstName, LastName: lastName, Status: "Active" }],
  [listName],
);

// Read contacts on the list
const { data } = await listsApi.listsByListnameContactsGet(listName, 50, 0);`;

  return (
    <main>
      <PageHeader
        title="Contacts"
        description="Add contacts to the list from ELASTICEMAIL_LIST_NAME and list them."
        sourcePath="src/app/contacts/page.jsx"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@yourdomain.com" />
        </div>

        <div className="field">
          <label htmlFor="firstName">First name</label>
          <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="lastName">Last name</label>
          <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Contact"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Contact Added" />

      <h2>Contacts in {listName || "list"}</h2>
      {listLoading && <p className="muted">Loading contacts...</p>}
      {listError && (
        <div className="result result-error">
          <p>{listError}</p>
        </div>
)}
      {!listLoading && !listError && contacts.length === 0 && <p className="muted">No contacts yet.</p>}
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
      <CodeBlock code={exampleCode} title="src/app/api/contacts/route.js" />
    </main>
);
}
