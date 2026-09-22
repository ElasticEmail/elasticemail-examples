// POST /api/contacts -> body { email, firstName?, lastName? }
import { defineEventHandler } from "h3";
import { apiError, contactsApi, fail, listName, listsApi, readJson } from "../utils/elasticemail";

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

export default defineEventHandler(async (event) => {
  const { email, firstName = "", lastName = "" } = await readJson(event);

  if (!email) {
    return fail(event, 400, "Missing required field: email");
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
    return {
      success: true,
      list: listName,
      contact: { Email: data[0]?.Email, Status: data[0]?.Status, Source: data[0]?.Source },
    };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return fail(event, status, error);
  }
});
