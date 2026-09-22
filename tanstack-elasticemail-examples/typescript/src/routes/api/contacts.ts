// GET  /api/contacts            -> contacts on ELASTICEMAIL_LIST_NAME
// POST /api/contacts            -> body { email, firstName?, lastName? }
import { createFileRoute } from "@tanstack/react-router";
import { apiError, contactsApi, json, listName, listsApi, readJson } from "../../lib/elasticemail";

// Elastic Email lists are addressed by name, not by id. Create it if missing.
async function ensureList() {
  try {
    await listsApi.listsPost({ ListName: listName, AllowUnsubscribe: true });
  } catch (err) {
    const { status, message } = apiError(err);
    if (status === 400 && /exist/i.test(message)) return;
    throw err;
  }
}

export const Route = createFileRoute("/api/contacts")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data } = await listsApi.listsByListnameContactsGet(listName, 50, 0);
          return json({
            list: listName,
            total: data.length,
            contacts: data.map((c) => ({
              Email: c.Email,
              FirstName: c.FirstName,
              LastName: c.LastName,
              Status: c.Status,
              Source: c.Source,
              DateAdded: c.DateAdded,
            })),
          });
        } catch (err) {
          const { status, message: error } = apiError(err);
          if (status === 404) {
            return json({ list: listName, total: 0, contacts: [], note: "List does not exist yet" });
          }
          return json({ error }, status);
        }
      },
      POST: async ({ request }) => {
        const { email, firstName = "", lastName = "" } = await readJson(request);

        if (!email) {
          return json({ error: "Missing required field: email" }, 400);
        }

        try {
          await ensureList();

          // Add the contact and put it on the list in one call
          const { data } = await contactsApi.contactsPost(
            [
              {
                Email: email,
                FirstName: firstName,
                LastName: lastName,
                Status: "Active",
              },
            ],
            [listName],
          );
          return json({
            success: true,
            list: listName,
            contact: { Email: data[0]?.Email, Status: data[0]?.Status, Source: data[0]?.Source },
          });
        } catch (err) {
          const { status, message: error } = apiError(err);
          return json({ error }, status);
        }
      },
    },
  },
});
