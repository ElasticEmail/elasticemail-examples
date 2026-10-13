# NestJS Email API Examples - Elastic Email

Send transactional and bulk email from a NestJS 11 app on Node.js with the [Elastic Email](https://elasticemail.com/email-api) email API. The official Elastic Email TypeScript SDK (`@elasticemail/elasticemail-client-ts-axios`) is wrapped in an injectable `ElasticEmailService`, so controllers get the email, contact and list clients through Nest dependency injection. Webhook routes verify Elastic Email's HMAC signature with a `WebhookGuard` (falling back to a `?token=` check for unsigned webhooks), inbound routes are protected by a `TokenGuard`, and an exception filter turns API failures into `{ "error": "..." }` responses. This stack is TypeScript only, because NestJS is built on decorators and a JavaScript variant would need a Babel setup that almost nobody uses.

> **First time here?** The [NestJS quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.4.0` · Node.js 20+ · NestJS 11

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
- `WebhookGuard` protects the webhook routes. When `ELASTICEMAIL_WEBHOOK_SECRET` is set it verifies
  the `X-ElasticEmail-Signature` HMAC over `req.rawBody` and answers `401` on a bad or stale
  signature; without a secret it delegates to `TokenGuard`.
- `TokenGuard` checks `?token=` against `ELASTICEMAIL_WEBHOOK_TOKEN` with `crypto.timingSafeEqual`
  and answers `401 { "error": "Invalid token" }` on a mismatch. Inbound email always uses it.
- `ApiExceptionFilter` is registered globally. Controllers simply `await` SDK calls; when the API
  answers `{ "Error": "..." }` with a 4xx/5xx, the filter responds `{ "error": "..." }` with the same
  status. Validation errors (`BadRequestException`) and unknown routes use the same shape.
- `main.ts` creates the app with `rawBody: true`, so signed webhooks can be verified against the
  body bytes as received, and raises the `urlencoded` body limit to 25 MB, because inbound email is
  a form POST that carries base64 attachments.

The app runs with `tsx`, which uses esbuild. esbuild does not emit decorator metadata, so Nest
cannot resolve constructor dependencies from their types alone. The controllers inject the service
with an explicit token: `constructor(@Inject(ElasticEmailService) private readonly ee: ElasticEmailService)`.
Keep that pattern, or switch to the Nest CLI (`nest start`) or SWC if you prefer type-based injection.

## API Endpoints

- `GET /health` - Health check
- `POST /send` - Send a transactional email. An optional `Idempotency-Key` request header is forwarded to Elastic Email (a new key is generated otherwise), so clients can retry safely with the same key
- `POST|GET /webhook` - Handle Elastic Email event notifications (signed POST, or `?token=...` when unsigned)
- `POST /inbound?token=...` - Receive inbound email pushed by an inbound route
- `POST /double-optin/subscribe` - Store a contact and send a confirmation email
- `GET /double-optin/confirm?email=...&token=...` - Add the contact to the list
- `POST|GET /double-optin/webhook` - Confirm via Clicked event instead of a link (signed POST, or `?token=...` when unsigned)

## Webhooks and inbound

The recommended setup is a signed webhook. `examples/webhooks.ts` creates it with
`EnableSigning: true` and `DeliveryMethod: WebhookDeliveryMethod.PostJson`, and prints the
`SigningSecret` (`whsec_...`) once; store it as `ELASTICEMAIL_WEBHOOK_SECRET`. Both options can be
set only when the webhook is created, and `webhookByPublicidSecretRotatePost` issues a new secret
(the old one stops working at once). Elastic Email then POSTs each event as a flat JSON body
(`status`, `to`, `transaction`, `messageid`, `category`, `target`, ...; `to`, `from`, `channel`,
`subject` and `messageid` may be `null`) with these headers:

- `X-ElasticEmail-Timestamp` - unix seconds
- `X-ElasticEmail-Signature` - `v1=<hex>`, a comma-separated list; any `v1=` entry may match
- `X-ElasticEmail-Webhook-Id`

The signature is the lowercase hex HMAC-SHA256, keyed with the secret, of
`{timestamp}\n{METHOD}\n{path and query as received}\n{raw body}`. `WebhookGuard` rebuilds it from
`req.originalUrl` and `req.rawBody` (kept by `rawBody: true` in `main.ts`), rejects timestamps more
than 300 seconds off and compares in constant time. A failed check answers `401`, and Elastic Email
retries. Signed webhooks do not follow redirects.

Unsigned webhooks still work: leave `ELASTICEMAIL_WEBHOOK_SECRET` empty and put a shared secret in
the URL (`?token=ELASTICEMAIL_WEBHOOK_TOKEN`), which `TokenGuard` checks with a constant-time compare.
Unsigned events arrive as a GET request with the same fields in the query string.

Inbound email arrives as a POST with form fields (`from_email`, `subject`, `body_text`, `body_html`,
`att1_name`, `att1_content`, ...). The domain's MX record must point at `mx.inbound.elasticemail.com`.

For local development expose the server with a tunnel such as ngrok and set `PUBLIC_URL` to it.
When you save a webhook, Elastic Email sends one test event to the URL and saves the webhook only
if it gets a 2xx response. For a signed webhook the test event arrives before your server knows the
secret, so a `401`/`403` answer is accepted too and the create call still succeeds. The test event carries sample values (`to=test@test.com`,
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
│   │   └── common/                            # TokenGuard, WebhookGuard, ApiExceptionFilter, HMAC helpers
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
