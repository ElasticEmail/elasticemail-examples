// GET|POST /.redwood/functions/doubleOptinWebhook
//
// Click-tracking based confirmation. Create an Elastic Email webhook for Clicked events
// pointing at this URL. When the clicked link is the confirmation link, the recipient
// is added to the list. GET answers the URL validation ping.
import type { APIGatewayEvent, Context } from "aws-lambda";
import { apiError, json, listName, listsApi, query, readEvent, sanitize, tokenOk } from "src/lib/elasticemail";

export const handler = async (event: APIGatewayEvent, _context: Context) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!tokenOk(query(event).get("token"))) {
    return json({ error: "Invalid token" }, 401);
  }

  const fields = await readEvent(event);
  if (fields.status !== "Clicked" || !String(fields.target ?? "").includes("/.redwood/functions/doubleOptinConfirm")) {
    return json({ received: true, status: sanitize(fields.status), message: "Event ignored" });
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [fields.to] });
    return json({ received: true, confirmed: true, email: sanitize(fields.to) });
  } catch (err) {
    const { status, message } = apiError(err);
    return json({ error: message }, status);
  }
};
