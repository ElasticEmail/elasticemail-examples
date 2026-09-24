import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import formbody from "@fastify/formbody";
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

const app = Fastify();
app.register(formbody);

// Events arrive as GET with the data in the query string, or as a form POST
app.route({
  method: ["GET", "POST"],
  url: "/double-optin/webhook",
  handler: async (req, reply) => {
    const event = { ...(req.body ?? {}), ...req.query };

    if (!tokenOk(event.token)) {
      return reply.status(401).send({ error: "Invalid token" });
    }

    const status = sanitize(event.status);
    const target = sanitize(event.target);
    const recipient = sanitize(event.to);

    // Elastic Email validates the URL with a test event when the webhook is saved.
    if (status !== "Clicked" || !target.includes("/double-optin/confirm")) {
      return { received: true, status, message: "Event ignored" };
    }

    try {
      await listsApi.listsByNameContactsPost(listName, { Emails: [recipient] });
      console.log("Subscription confirmed via click:", recipient);
      return { received: true, confirmed: true, email: recipient, list: listName };
    } catch (err) {
      console.error("Error adding contact to list:", err.response?.status, err.response?.data ?? err.message);
      return reply.status(500).send({ error: err.response?.data?.Error ?? err.message });
    }
  },
});

const port = Number(process.env.PORT) || 3000;
// All interfaces, like app.listen(port) in Express, so the app is reachable inside a container
await app.listen({ port, host: "0.0.0.0" });
console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
