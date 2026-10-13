import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import express, { type Request, type Response } from "express";
import { Configuration, ListsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.ts) pointing at /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const listsApi = new ListsApi(config);

const listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
const expectedToken = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
// Signing secret returned once when the webhook is created with EnableSigning
const webhookSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET;

type RawRequest = Request & { rawBody?: Buffer };

const tokenOk = (token: unknown) => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(expectedToken);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Verify an Elastic Email webhook signature: lowercase hex HMAC-SHA256 (key = signing secret) of
 * "{timestamp}\n{METHOD}\n{path + query as received}\n{raw body}", sent as "v1=<hex>" entries
 * in X-ElasticEmail-Signature. Rejects timestamps more than 5 minutes off.
 */
const verifySignature = (
  signingSecret: string,
  method: string,
  target: string,
  rawBody: Buffer | string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean => {
  const ts = Number(timestamp);
  if (!timestamp || !Number.isInteger(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = Buffer.from(
    createHmac("sha256", signingSecret)
      .update(`${timestamp}\n${method}\n${target}\n`)
      .update(rawBody)
      .digest("hex"),
  );
  return String(signature ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .some((part) => {
      const given = Buffer.from(part.slice(3));
      return given.length === expected.length && timingSafeEqual(given, expected);
    });
};

const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

const app = express();
app.use(express.urlencoded({ extended: false }));
// Keep the raw bytes: webhook signatures are computed over the body exactly as sent
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as RawRequest).rawBody = buf;
    },
  }),
);

// Signed webhooks (EnableSigning + DeliveryMethod PostJson) arrive as POST with a JSON body;
// unsigned ones as GET with the fields in the query string and the shared ?token=.
app.all("/double-optin/webhook", async (req: Request, res: Response) => {
  let event: Record<string, unknown>;
  if (webhookSecret) {
    const ok = verifySignature(
      webhookSecret,
      req.method,
      req.originalUrl,
      (req as RawRequest).rawBody ?? "",
      req.get("X-ElasticEmail-Timestamp"),
      req.get("X-ElasticEmail-Signature"),
    );
    if (!ok) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
    event = req.method === "POST" ? (req.body ?? {}) : req.query;
  } else {
    if (!tokenOk(req.query.token)) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    event = { ...req.query, ...(req.body ?? {}) };
  }

  const status = sanitize(event.status);
  const target = sanitize(event.target);
  const recipient = sanitize(event.to);

  // Elastic Email validates the URL with a test event when the webhook is saved.
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
