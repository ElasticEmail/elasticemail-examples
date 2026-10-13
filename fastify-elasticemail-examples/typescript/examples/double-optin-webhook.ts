import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import formbody from "@fastify/formbody";
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

type Fields = Record<string, string>;

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

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
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean => {
  const ts = Number(timestamp);
  if (!timestamp || !Number.isInteger(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = Buffer.from(
    createHmac("sha256", signingSecret)
      .update(`${timestamp}\n${method}\n${target}\n${rawBody}`)
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

const app = Fastify();
app.register(formbody);
// Keep the raw JSON text: webhook signatures are computed over the body exactly as sent
app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
  req.rawBody = body as string;
  try {
    done(null, body === "" ? undefined : JSON.parse(body as string));
  } catch (err) {
    (err as any).statusCode = 400;
    done(err as Error, undefined);
  }
});

// Signed webhooks (EnableSigning + DeliveryMethod PostJson) arrive as POST with a JSON body;
// unsigned ones as GET with the data in the query string and the shared ?token=.
app.route({
  method: ["GET", "POST"],
  url: "/double-optin/webhook",
  handler: async (req, reply) => {
    let event: Record<string, unknown>;
    if (webhookSecret) {
      const ok = verifySignature(
        webhookSecret,
        req.method,
        req.url,
        req.rawBody ?? "",
        req.headers["x-elasticemail-timestamp"] as string | undefined,
        req.headers["x-elasticemail-signature"] as string | undefined,
      );
      if (!ok) {
        return reply.status(401).send({ error: "Invalid signature" });
      }
      event = req.method === "POST" ? ((req.body ?? {}) as Record<string, unknown>) : (req.query as Fields);
    } else {
      event = { ...((req.body ?? {}) as Fields), ...(req.query as Fields) };
      if (!tokenOk(event.token)) {
        return reply.status(401).send({ error: "Invalid token" });
      }
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
    } catch (err: any) {
      console.error("Error adding contact to list:", err.response?.status, err.response?.data ?? err.message);
      return reply.status(500).send({ error: err.response?.data?.Error ?? err.message });
    }
  },
});

const port = Number(process.env.PORT) || 3000;
// All interfaces, like app.listen(port) in Express, so the app is reachable inside a container
await app.listen({ port, host: "0.0.0.0" });
console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
