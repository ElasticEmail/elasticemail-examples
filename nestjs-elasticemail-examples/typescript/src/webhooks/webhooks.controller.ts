import { Body, Controller, Get, HttpCode, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ElasticEmailService } from "../elasticemail/elasticemail.service";
import { sanitize } from "../common/security";
import { TokenGuard } from "../common/token.guard";

type Fields = Record<string, string>;

@Controller()
@UseGuards(TokenGuard)
export class WebhooksController {
  constructor(@Inject(ElasticEmailService) private readonly ee: ElasticEmailService) {}

  // Elastic Email event notifications. Parameters arrive in the query string (GET) or as
  // form fields (POST): transaction, messageid, to, from, subject, date, status, category,
  // channel, target (clicked URL), IP, Useragent, Country, City.
  // Elastic Email sends a GET to validate the URL when the webhook is saved.
  @Get("webhook")
  webhookGet(@Query() query: Fields) {
    return this.handleEvent({ ...query });
  }

  @Post("webhook")
  @HttpCode(200)
  webhookPost(@Query() query: Fields, @Body() body: Fields) {
    return this.handleEvent({ ...query, ...(body ?? {}) });
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
        console.log("Email opened from", sanitize(event.Country), sanitize(event.City));
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
  @Post("inbound")
  @HttpCode(200)
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
