import { timingSafeEqual } from "node:crypto";
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname !== "/double-optin/webhook") {
      return json({ error: "Not found" }, 404);
    }

    if (!tokenOk(url.searchParams.get("token"))) {
      return json({ error: "Invalid token" }, 401);
    }

    // Elastic Email validates the URL with a GET when the webhook is saved.
    if (req.method === "GET") {
      return json({ ok: true });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // Elastic Email posts form-encoded fields
    const event = Object.fromEntries(url.searchParams);
    const form = await req.formData();
    form.forEach((v, k) => {
      if (typeof v === "string") event[k] = v;
    });

    const status = sanitize(event.status);
    const target = sanitize(event.target);
    const recipient = sanitize(event.to);

    if (status !== "Clicked" || !target.includes("/double-optin/confirm")) {
      return json({ received: true, status, message: "Event ignored" });
    }

    try {
      await listsApi.listsByNameContactsPost(listName, { Emails: [recipient] });
      console.log("Subscription confirmed via click:", recipient);
      return json({ received: true, confirmed: true, email: recipient, list: listName });
    } catch (err) {
      console.error("Error adding contact to list:", err.response?.status, err.response?.data ?? err.message);
      return json({ error: err.response?.data?.Error ?? err.message }, 500);
    }
  },
});

console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
