// GET /api/double-optin/webhook
//
// Elastic Email sends a GET to validate the URL when an unsigned webhook is saved.
import { defineEventHandler } from "h3";
import { fail, readWebhook } from "../../utils/elasticemail";

export default defineEventHandler(async (event) => {
  // Signed GET webhooks are verified like POSTs; unsigned ones carry ?token=
  if (!(await readWebhook(event))) {
    return fail(event, 401, "Invalid signature or token");
  }

  return { ok: true };
});
