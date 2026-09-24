# Send your first email with NestJS

Five minutes from a clean clone to a delivered email, using NestJS 11 on Node.js and the Elastic
Email TypeScript SDK wrapped as an injectable service.

## Prerequisites

- Node.js 20+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

Creating and managing keys is covered in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. Every email has
to come from an address on a verified domain - there is no shared sandbox sender.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/nestjs-elasticemail-examples/typescript

npm install
cp ../.env.example .env
```

In a Nest project of your own:

```bash
npm install @elasticemail/elasticemail-client-ts-axios dotenv
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

Full list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

The shortest possible version, without Nest - this is `examples/basic-send.ts`:

```bash
npx tsx examples/basic-send.ts
```

## 6. Run the NestJS server

```bash
npm run dev
```

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from NestJS!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

The SDK lives in one provider, `src/elasticemail/elasticemail.service.ts`:

```typescript
@Injectable()
export class ElasticEmailService {
  readonly emails: EmailsApi;
  readonly from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";

  constructor() {
    const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
    this.emails = new EmailsApi(config);
    // ContactsApi and ListsApi are built the same way
  }
}
```

The route in `src/email/email.controller.ts` injects it:

```typescript
@Controller()
export class EmailController {
  constructor(@Inject(ElasticEmailService) private readonly ee: ElasticEmailService) {}

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
```

If the API rejects the call, the global `ApiExceptionFilter` answers `{ "error": "<API message>" }`
with the API's status code, so the controller needs no try/catch. The explicit
`@Inject(ElasticEmailService)` is there because `tsx` does not emit decorator metadata.

## Next steps

There are 18 standalone examples in `examples/`. Run any of them the same way:

```bash
npx tsx examples/batch-send.ts            # one call, personalized per recipient
npx tsx examples/with-attachments.ts      # base64 file attachment
npx tsx examples/with-template.ts         # hosted template + merge values
npx tsx examples/scheduled-send.ts        # delayed delivery
npx tsx examples/webhooks.ts              # create, list, delete a webhook
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Receive delivery events | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Handle API failures properly | [Error handling](../docs/error-handling.md) |
| Every example and route | [README.md](README.md) |
