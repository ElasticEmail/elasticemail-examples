// GET /api/double-optin/webhook?token=...
//
// Elastic Email sends a GET to validate the URL when the webhook is saved.
import { defineEventHandler, getQuery } from "h3";
import { fail, tokenOk } from "../../utils/elasticemail";

export default defineEventHandler((event) => {
  if (!tokenOk(getQuery(event).token)) {
    return fail(event, 401, "Invalid token");
  }
  return { ok: true };
});
