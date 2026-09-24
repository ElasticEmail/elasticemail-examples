import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ElasticEmailService } from "../elasticemail/elasticemail.service";
import { hmac, safeEqual, sanitize } from "../common/security";
import { TokenGuard } from "../common/token.guard";

type Fields = Record<string, string>;

@Controller("double-optin")
export class DoubleOptinController {
  constructor(@Inject(ElasticEmailService) private readonly ee: ElasticEmailService) {}

  @Post("subscribe")
  @HttpCode(200)
  async subscribe(@Body() body: { email?: string; name?: string }) {
    const { email, name = "" } = body ?? {};
    if (!email) {
      throw new BadRequestException("Missing required field: email");
    }

    const confirmUrl = `${this.ee.publicUrl}/double-optin/confirm?email=${encodeURIComponent(email)}&token=${hmac(email)}`;
    const greeting = name ? `Welcome, ${name}!` : "Welcome!";

    // Stored as Transactional so it receives the confirmation but no campaigns yet
    await this.ee.contacts.contactsPost([
      { Email: email, FirstName: name.split(" ")[0] || "", Status: "Transactional" },
    ]);

    const { data } = await this.ee.emails.emailsTransactionalPost({
      Recipients: { To: [email] },
      Content: {
        From: this.ee.from,
        Subject: "Confirm your subscription",
        Body: [
          {
            ContentType: "HTML",
            Content: `<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>${greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="${confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>`,
          },
        ],
      },
    });

    return { success: true, message: "Confirmation email sent", messageId: data.MessageID };
  }

  @Get("confirm")
  async confirm(@Query("email") emailParam: unknown, @Query("token") token: unknown, @Res() res: Response) {
    const email = String(emailParam ?? "");
    if (!email || !safeEqual(token, hmac(email))) {
      throw new BadRequestException("Invalid confirmation link");
    }

    await this.ee.lists.listsByNameContactsPost(this.ee.listName, { Emails: [email] });
    if (this.ee.confirmRedirectUrl) {
      res.redirect(this.ee.confirmRedirectUrl);
      return;
    }
    res.json({ confirmed: true, email, list: this.ee.listName });
  }

  // Click-tracking based confirmation: create a webhook for Clicked events pointing here.
  // Elastic Email sends events as GET; a form POST is accepted too.
  @Get("webhook")
  @UseGuards(TokenGuard)
  webhookGet(@Query() query: Fields) {
    return this.handleClick({ ...query });
  }

  @Post("webhook")
  @HttpCode(200)
  @UseGuards(TokenGuard)
  webhookPost(@Query() query: Fields, @Body() body: Fields) {
    return this.handleClick({ ...query, ...(body ?? {}) });
  }

  private async handleClick(event: Fields) {
    if (event.status !== "Clicked" || !String(event.target ?? "").includes("/double-optin/confirm")) {
      return { received: true, status: sanitize(event.status), message: "Event ignored" };
    }

    await this.ee.lists.listsByNameContactsPost(this.ee.listName, { Emails: [event.to] });
    return { received: true, confirmed: true, email: sanitize(event.to) };
  }
}
