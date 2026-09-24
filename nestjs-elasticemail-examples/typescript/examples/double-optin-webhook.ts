import "dotenv/config";
import "reflect-metadata";
import { timingSafeEqual } from "node:crypto";
import { Body, Controller, Get, HttpCode, HttpException, Module, Post, Query } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Configuration, ListsApi } from "@elasticemail/elasticemail-client-ts-axios";

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.ts) pointing at /double-optin/webhook.
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

type Fields = Record<string, string>;

@Controller("double-optin")
class DoubleOptinWebhookController {
  // Events arrive as GET with the data in the query string
  @Get("webhook")
  onGet(@Query() query: Fields) {
    return handle({ ...query });
  }

  // ...or as a form POST
  @Post("webhook")
  @HttpCode(200)
  onPost(@Query() query: Fields, @Body() body: Fields) {
    return handle({ ...(body ?? {}), ...query });
  }
}

async function handle(event: Fields) {
  if (!tokenOk(event.token)) {
    throw new HttpException({ error: "Invalid token" }, 401);
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
    throw new HttpException({ error: err.response?.data?.Error ?? err.message }, 500);
  }
}

@Module({ controllers: [DoubleOptinWebhookController] })
class AppModule {}

const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
const port = Number(process.env.PORT) || 3000;
await app.listen(port);
console.log(`Double opt-in webhook listening on http://localhost:${port}/double-optin/webhook`);
