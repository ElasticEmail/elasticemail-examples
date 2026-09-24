import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post } from "@nestjs/common";
import { ElasticEmailService } from "../elasticemail/elasticemail.service";

interface SendDto {
  to?: string;
  subject?: string;
  message?: string;
}

@Controller()
export class EmailController {
  // Explicit @Inject token: tsx (esbuild) does not emit decorator metadata, so Nest
  // cannot infer the dependency from the parameter type alone.
  constructor(@Inject(ElasticEmailService) private readonly ee: ElasticEmailService) {}

  @Get("health")
  health() {
    return { status: "ok" };
  }

  @Post("send")
  @HttpCode(200)
  async send(@Body() body: SendDto = {}) {
    const { to, subject, message } = body ?? {};
    if (!to || !subject || !message) {
      throw new BadRequestException("Missing required fields: to, subject, message");
    }

    const { data } = await this.ee.emails.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: this.ee.from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return { success: true, transactionId: data.TransactionID, messageId: data.MessageID };
  }
}
