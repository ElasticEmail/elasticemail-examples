import { Body, Controller, Get, HttpCode, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ElasticEmailService } from "../elasticemail/elasticemail.service";
import { sanitize, webhookEvent } from "../common/security";
import { TokenGuard, WebhookGuard } from "../common/token.guard";

type Fields = Record<string, string>;

@Controller()
export class WebhooksController {
  constructor(@Inject(ElasticEmailService) private readonly ee: ElasticEmailService) {}

  // Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
  // category, channel, target (clicked URL), ip, useragent, country, city.
  // Signed webhooks (EnableSigning + DeliveryMethod PostJson, ELASTICEMAIL_WEBHOOK_SECRET set) arrive
  // as POST with a JSON body; WebhookGuard verifies the signature. Unsigned webhooks arrive as GET with
  // the fields in the query string and are checked against ?token= instead.
  @Get("webhook")
  @UseGuards(WebhookGuard)
  webhookGet(@Query() query: Fields) {
    return this.handleEvent(webhookEvent(query));
  }

  @Post("webhook")
  @HttpCode(200)
  @UseGuards(WebhookGuard)
  webhookPost(@Query() query: Fields, @Body() body: Fields) {
    return this.handleEvent(webhookEvent(query, body));
  }

  private handleEvent(event: Fields) {
    const status = sanitize(event.status);

    if (!status) {
      // Validation ping or empty request
      return { ok: true };
    }

    console.log("Webhook event:", status, "to:", sanitize(event.to), "transaction:", sanitize(event.transaction));

    switch (status) {
      case "Sent":
        console.log("Email sent, message id:", sanitize(event.messageid));
        break;
      case "Opened":
        console.log("Email opened from", sanitize(event.country), sanitize(event.city));
        break;
      case "Clicked":
        console.log("Link clicked:", sanitize(event.target));
        break;
      case "Error":
        console.log("Bounce/error, category:", sanitize(event.category));
        break;
      case "AbuseReport":
        console.log("Complaint received");
        break;
      case "Unsubscribed":
        console.log("Recipient unsubscribed");
        break;
    }

    return { received: true, status };
  }

  // Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
  // Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
  // subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
  // Inbound email is not signed, so it always uses the ?token= check.
  @Post("inbound")
  @HttpCode(200)
  @UseGuards(TokenGuard)
  async inbound(@Body() body: Fields) {
    const mail = body ?? {};
    const attachments = Object.keys(mail)
      .filter((k) => /^att\d+_name$/.test(k))
      .map((k) => ({ name: mail[k], content: mail[k.replace("_name", "_content")] }));

    console.log("Inbound email from:", sanitize(mail.from_email), "subject:", sanitize(mail.subject));
    console.log("Attachments:", attachments.map((a) => a.name).join(", ") || "none");

    // Forward a copy to the team inbox
    const { data } = await this.ee.emails.emailsTransactionalPost({
      Recipients: { To: [this.ee.contactEmail] },
      Content: {
        From: this.ee.from,
        ReplyTo: mail.from_email,
        Subject: `Fwd: ${mail.subject ?? "(no subject)"}`,
        Body: [
          {
            ContentType: "HTML",
            Content: mail.body_html || `<pre>${(mail.body_text ?? "").replace(/</g, "&lt;")}</pre>`,
          },
        ],
        Attachments: attachments
          .filter((a) => a.content)
          .map((a) => ({ Name: a.name, BinaryContent: a.content })),
      },
    });
    return { received: true, forwardedMessageId: data.MessageID };
  }
}
