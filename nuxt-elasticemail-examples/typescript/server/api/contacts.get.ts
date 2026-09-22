// GET /api/contacts -> contacts on ELASTICEMAIL_LIST_NAME
import { defineEventHandler } from "h3";
import { apiError, fail, listName, listsApi } from "../utils/elasticemail";

export default defineEventHandler(async (event) => {
  try {
    const { data } = await listsApi.listsByListnameContactsGet(listName, 50, 0);
    return {
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
    };
  } catch (err) {
    const { status, message: error } = apiError(err);
    if (status === 404) {
      return { list: listName, total: 0, contacts: [], note: "List does not exist yet" };
    }
    return fail(event, status, error);
  }
});
