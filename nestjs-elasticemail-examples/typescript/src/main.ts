import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";

const app = await NestFactory.create<NestExpressApplication>(AppModule);

// Elastic Email webhooks and inbound notifications are form-encoded; inbound email carries
// base64 attachments, so raise the limit well above the 100kb default.
app.useBodyParser("urlencoded", { extended: false, limit: "25mb" });
app.useGlobalFilters(new ApiExceptionFilter());

const port = process.env.PORT || 3000;
await app.listen(port);
console.log(`NestJS server running on http://localhost:${port}`);
