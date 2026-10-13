import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";

// rawBody: true keeps the unparsed body on req.rawBody, which WebhookGuard needs to verify
// signed webhooks (the signature covers the body bytes exactly as received).
const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

// Signed webhooks arrive as POST with a JSON body (default json parser). Unsigned webhooks and
// inbound notifications are GET or form-encoded; inbound email carries base64 attachments, so
// raise the urlencoded limit well above the 100kb default.
app.useBodyParser("urlencoded", { extended: false, limit: "25mb" });
app.useGlobalFilters(new ApiExceptionFilter());

const port = process.env.PORT || 3000;
await app.listen(port);
console.log(`NestJS server running on http://localhost:${port}`);
