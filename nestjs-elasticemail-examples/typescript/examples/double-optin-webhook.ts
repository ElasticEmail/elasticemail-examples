import "dotenv/config";
import "reflect-metadata";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Body, Controller, Get, HttpCode, HttpException, Module, Post, Query, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { NestFactory } from "@nestjs/core";
import { Configuration, ListsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.ts) pointing at /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.
// Signed webhooks (EnableSigning + DeliveryMethod PostJson) arrive as POST with a JSON body and are
// verified with ELASTICEMAIL_WEBHOOK_SECRET. Without a secret, unsigned webhooks are checked
// against ?token=ELASTICEMAIL_WEBHOOK_TOKEN.

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const listsApi = new ListsApi(config);

const listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
const expectedToken = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
const signingSecret = process.env.ELASTICEMAIL_WEBHOOK_SECRET || "";

const safeEqual = (given: unknown, expected: string) => {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

// HMAC-SHA256 over `${timestamp}\n${METHOD}\n${path+query as received}\n${raw body}`; the
// signature header is a comma-separated list of v1=<hex>, any match is accepted.
const signatureOk = (req: RawBodyRequest<Request>) => {
  const ts = String(req.headers["x-elasticemail-timestamp"] ?? "");
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", signingSecret)
    .update(`${ts}\n${req.method}\n${req.originalUrl}\n`)
    .update(req.rawBody ?? "")
    .digest("hex");
  return String(req.headers["x-elasticemail-signature"] ?? "")
    .split(",")
    .some((part) => part.trim().startsWith("v1=") && safeEqual(part.trim().slice(3), expected));
};

const authorize = (req: RawBodyRequest<Request>) => {
  const ok = signingSecret ? signatureOk(req) : safeEqual(req.query.token, expectedToken);
  if (!ok) throw new HttpException({ error: signingSecret ? "Invalid signature" : "Invalid token" }, 401);
};

const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

type Fields = Record<string, string>;

@Controller("double-optin")
class DoubleOptinWebhookController {
  // Unsigned webhooks: GET with the data in the query string
  @Get("webhook")
  onGet(@Req() req: RawBodyRequest<Request>, @Query() query: Fields) {
    authorize(req);
    return handle({ ...query });
  }

  // Signed webhooks: POST with a JSON body (unsigned form POSTs are accepted too)
  @Post("webhook")
  @HttpCode(200)
  onPost(@Req() req: RawBodyRequest<Request>, @Query() query: Fields, @Body() body: Fields) {
    authorize(req);
    return handle(signingSecret ? { ...(body ?? {}) } : { ...(body ?? {}), ...query });
  }
}

async function handle(event: Fields) {
  const status = sanitize(event.status);
  const target = sanitize(event.target);
  const recipient = sanitize(event.to);

  // Elastic Email validates the URL with a test event when the webhook is saved.
  if (status !== "Clicked" || !recipient || !target.includes("/double-optin/confirm")) {
    return { received: true, status, message: "Event ignored" };
  }

  try {
    await listsApi.listsByNameContactsPost(listName, { Emails: [recipient] });
    console.log("Subscription confirmed via click:", recipient);
    return { received: true, confirmed: true, email: recipient, list: listName };
  } catch (err: any) {
    console.error("Error adding contact to list:", err.response?.status, err.response?.data ?? err.message);
    throw new HttpException({ error: err.response?.data?.Error ?? err.message }, 500);
  }
}

@Module({ controllers: [DoubleOptinWebhookController] })
class AppModule {}

// rawBody: true keeps req.rawBody, the exact bytes the signature covers
const app = await NestFactory.create(AppModule, { logger: ["error", "warn"], rawBody: true });
const port = Number(process.env.PORT) || 3000;
await app.listen(port);
console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
