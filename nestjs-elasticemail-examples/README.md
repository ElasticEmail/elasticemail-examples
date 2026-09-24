# NestJS Email API Examples - Elastic Email

Send transactional and bulk email from a NestJS 11 app on Node.js with the [Elastic Email](https://elasticemail.com/email-api) email API. The official Elastic Email TypeScript SDK (`@elasticemail/elasticemail-client-ts-axios`) is wrapped in an injectable `ElasticEmailService`, so controllers get the email, contact and list clients through Nest dependency injection. Webhook and inbound routes are protected by a `TokenGuard`, and an exception filter turns API failures into `{ "error": "..." }` responses. This stack is TypeScript only, because NestJS is built on decorators and a JavaScript variant would need a Babel setup that almost nobody uses.

> **First time here?** The [NestJS quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · NestJS 11

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

```bash
cd typescript

# Install dependencies
npm install

# Copy environment variables
cp ../.env.example .env

# Add your Elastic Email API key and sender address to .env
```

## Standalone Examples

The scripts in `examples/` call the SDK directly, with no Nest container, so you can read each use
case on its own. `double-optin-webhook.ts` is the exception: it is a one-file NestJS app with a
single controller.

```bash
cd typescript
npx tsx examples/basic-send.ts
npx tsx examples/batch-send.ts
npx tsx examples/with-attachments.ts
npx tsx examples/with-cid-attachments.ts
npx tsx examples/with-template.ts
npx tsx examples/scheduled-send.ts
npx tsx examples/prevent-threading.ts
npx tsx examples/contacts.ts
npx tsx examples/domains.ts
npx tsx examples/email-status.ts <transactionId> [messageId]
npx tsx examples/webhooks.ts
npx tsx examples/inbound.ts
npx tsx examples/double-optin-subscribe.ts user@example.com "John Doe"
npx tsx examples/double-optin-webhook.ts
npx tsx examples/suppressions.ts
npx tsx examples/email-verification.ts user@example.com
npx tsx examples/statistics.ts
npx tsx examples/sub-accounts.ts
```

## NestJS Application

```bash
cd typescript
npm run dev   # restarts on file changes

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from NestJS!"}'
```

How the app is put together:

- `ElasticEmailModule` is a global module that provides `ElasticEmailService`. The service builds one
  `Configuration` from `ELASTICEMAIL_API_KEY` and exposes `emails` (`EmailsApi`), `contacts`
  (`ContactsApi`) and `lists` (`ListsApi`), plus the sender and list settings read from the environment.
- `TokenGuard` checks `?token=` against `ELASTICEMAIL_WEBHOOK_TOKEN` with `crypto.timingSafeEqual`
  and answers `401 { "error": "Invalid token" }` on a mismatch.
- `ApiExceptionFilter` is registered globally. Controllers simply `await` SDK calls; when the API
  answers `{ "Error": "..." }` with a 4xx/5xx, the filter responds `{ "error": "..." }` with the same
  status. Validation errors (`BadRequestException`) and unknown routes use the same shape.
- `main.ts` raises the `urlencoded` body limit to 25 MB, because inbound email is a form POST that
  carries base64 attachments.

The app runs with `tsx`, which uses esbuild. esbuild does not emit decorator metadata, so Nest
cannot resolve constructor dependencies from their types alone. The controllers inject the service
with an explicit token: `constructor(@Inject(ElasticEmailService) private readonly ee: ElasticEmailService)`.
Keep that pattern, or switch to the Nest CLI (`nest start`) or SWC if you prefer type-based injection.

## API Endpoints

- `GET /health` - Health check
- `POST /send` - Send a transactional email
- `GET|POST /webhook?token=...` - Handle Elastic Email event notifications
- `POST /inbound?token=...` - Receive inbound email pushed by an inbound route
- `POST /double-optin/subscribe` - Store a contact and send a confirmation email
- `GET /double-optin/confirm?email=...&token=...` - Add the contact to the list
- `GET|POST /double-optin/webhook?token=...` - Confirm via Clicked event instead of a link

## Webhooks and inbound

Elastic Email does not sign webhook requests. The examples put a shared secret in the URL
(`?token=ELASTICEMAIL_WEBHOOK_TOKEN`) and `TokenGuard` checks it with a constant-time compare.
Elastic Email sends each event as a GET request with the details in the query string: `status`
(Sent, Opened, Clicked, Error, AbuseReport, Unsubscribed), `to`, `transaction`, `messageid`,
`category`, `target`.

Inbound email arrives as a POST with form fields (`from_email`, `subject`, `body_text`, `body_html`,
`att1_name`, `att1_content`, ...). The domain's MX record must point at `mx.inbound.elasticemail.com`.

For local development expose the server with a tunnel such as ngrok and set `PUBLIC_URL` to it.
When you save a webhook, Elastic Email sends one test event to the URL and saves the webhook only
if it gets a 2xx response. The test event carries sample values (`to=test@test.com`,
`messageid=abc1234`). The handlers accept it like any other event; in your own app, skip it before
it reaches your data.

## Quick Usage

```typescript
import { Controller, Inject, Post } from "@nestjs/common";
import { ElasticEmailService } from "./elasticemail/elasticemail.service";

@Controller()
export class HelloController {
  constructor(@Inject(ElasticEmailService) private readonly ee: ElasticEmailService) {}

  @Post("hello")
  async hello() {
    const { data } = await this.ee.emails.emailsTransactionalPost({
      Recipients: { To: ["you@yourdomain.com"] },
      Content: {
        From: this.ee.from,
        Subject: "Hello",
        Body: [
          { ContentType: "HTML", Content: "<p>Hello World</p>" },
          { ContentType: "PlainText", Content: "Hello World" },
        ],
      },
    });
    return { transactionId: data.TransactionID };
  }
}
```

## Project Structure

```
nestjs-elasticemail-examples/
├── typescript/
│   ├── examples/                              # 18 standalone examples
│   ├── src/
│   │   ├── main.ts                            # bootstrap, body limits, global filter
│   │   ├── app.module.ts
│   │   ├── elasticemail/                      # ElasticEmailModule + ElasticEmailService (SDK provider)
│   │   ├── email/email.controller.ts          # GET /health, POST /send
│   │   ├── webhooks/webhooks.controller.ts    # /webhook, /inbound
│   │   ├── double-optin/double-optin.controller.ts
│   │   └── common/                            # TokenGuard, ApiExceptionFilter, HMAC helpers
│   ├── package.json
│   └── tsconfig.json
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [NestJS documentation](https://docs.nestjs.com)

## License

MIT
