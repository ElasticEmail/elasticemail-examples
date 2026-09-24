import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { Configuration, ListsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.js) pointing at /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const listsApi = new ListsApi(config);

const listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
const expectedToken = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";

const tokenOk = (token) => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(expectedToken);
  return a.length === b.length && timingSafeEqual(a, b);
};

const sanitize = (value) => String(value ?? "").replace(/[\r\n]/g, "");

const sendJson = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname !== "/double-optin/webhook" || (req.method !== "GET" && req.method !== "POST")) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  // Events arrive as GET with the data in the query string, or as a form POST
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const event = {
    ...Object.fromEntries(new URLSearchParams(raw)),
    ...Object.fromEntries(url.searchParams),
  };

  if (!tokenOk(event.token)) {
    sendJson(res, 401, { error: "Invalid token" });
    return;
  }

  const status = sanitize(event.status);
  const target = sanitize(event.target);
  const recipient = sanitize(event.to);

  // Elastic Email validates the URL with a test event when the webhook is saved.
  if (status !== "Clicked" || !target.includes("/double-optin/confirm")) {
    sendJson(res, 200, { received: true, status, message: "Event ignored" });
    return;
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [recipient] });
    console.log("Subscription confirmed via click:", recipient);
    sendJson(res, 200, { received: true, confirmed: true, email: recipient, list: listName });
  } catch (err) {
    console.error("Error adding contact to list:", err.response?.status, err.response?.data ?? err.message);
    sendJson(res, 500, { error: err.response?.data?.Error ?? err.message });
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
});
