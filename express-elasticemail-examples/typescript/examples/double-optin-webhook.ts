import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import express, { type Request, type Response } from "express";
import { Configuration, ListsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.ts) pointing at POST /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const listsApi = new ListsApi(config);

const listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
const expectedToken = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";

const tokenOk = (token: unknown) => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(expectedToken);
  return a.length === b.length && timingSafeEqual(a, b);
};

const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Elastic Email validates the URL with a GET when the webhook is saved.
app.get("/double-optin/webhook", (req: Request, res: Response) => {
  if (!tokenOk(req.query.token)) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  res.json({ ok: true });
});

app.post("/double-optin/webhook", async (req: Request, res: Response) => {
  if (!tokenOk(req.query.token)) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const event = { ...req.query, ...req.body } as Record<string, string>;
  const status = sanitize(event.status);
  const target = sanitize(event.target);
  const recipient = sanitize(event.to);

  if (status !== "Clicked" || !target.includes("/double-optin/confirm")) {
    res.json({ received: true, status, message: "Event ignored" });
    return;
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [recipient] });
    console.log("Subscription confirmed via click:", recipient);
    res.json({ received: true, confirmed: true, email: recipient, list: listName });
  } catch (err: any) {
    console.error("Error adding contact to list:", err.response?.status, err.response?.data ?? err.message);
    res.status(500).json({ error: err.response?.data?.Error ?? err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
});
