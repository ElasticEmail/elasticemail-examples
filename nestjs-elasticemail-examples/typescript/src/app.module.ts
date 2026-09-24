import { Module } from "@nestjs/common";
import { ElasticEmailModule } from "./elasticemail/elasticemail.module";
import { EmailController } from "./email/email.controller";
import { WebhooksController } from "./webhooks/webhooks.controller";
import { DoubleOptinController } from "./double-optin/double-optin.controller";

@Module({
  imports: [ElasticEmailModule],
  controllers: [EmailController, WebhooksController, DoubleOptinController],
})
export class AppModule {}
