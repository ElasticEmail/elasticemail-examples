import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Configuration, ListsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.js) pointing at POST /double-optin/webhook.
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

const app = new Hono();

// Elastic Email validates the URL with a GET when the webhook is saved.
app.get("/double-optin/webhook", (c) => {
  if (!tokenOk(c.req.query("token"))) {
    return c.json({ error: "Invalid token" }, 401);
  }
  return c.json({ ok: true });
});

app.post("/double-optin/webhook", async (c) => {
  if (!tokenOk(c.req.query("token"))) {
    return c.json({ error: "Invalid token" }, 401);
  }

  // Elastic Email posts form-encoded fields
  const body = await c.req.parseBody();
  const event = { ...c.req.query(), ...body };
  const status = sanitize(event.status);
  const target = sanitize(event.target);
  const recipient = sanitize(event.to);

  if (status !== "Clicked" || !target.includes("/double-optin/confirm")) {
    return c.json({ received: true, status, message: "Event ignored" });
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [recipient] });
    console.log("Subscription confirmed via click:", recipient);
    return c.json({ received: true, confirmed: true, email: recipient, list: listName });
  } catch (err) {
    console.error("Error adding contact to list:", err.response?.status, err.response?.data ?? err.message);
    return c.json({ error: err.response?.data?.Error ?? err.message }, 500);
  }
});

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, () => {
  console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
});
