# Bun Email API Examples - Elastic Email

Send transactional and bulk email from [Bun](https://bun.sh) with the [Elastic Email](https://elasticemail.com/email-api) email API. Everything runs on `Bun.serve()` and Bun's built-in `.env` loading - no bundler, no extra tooling. TypeScript and JavaScript variants are included.

> **First time here?** The [Bun quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.3.0` · Bun 1.1+ · Bun.serve()

## Prerequisites

- Bun 1.1+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

```bash
# Choose your variant
cd typescript  # or javascript

# Install dependencies
bun install

# Copy environment variables (Bun loads .env automatically)
cp ../.env.example .env

# Add your Elastic Email API key and sender address to .env
```

## Standalone Examples

Bun runs TypeScript directly, so there is no build step.

### TypeScript
```bash
cd typescript
bun run examples/basic-send.ts
bun run examples/batch-send.ts
bun run examples/with-attachments.ts
bun run examples/with-cid-attachments.ts
bun run examples/with-template.ts
bun run examples/scheduled-send.ts
bun run examples/prevent-threading.ts
bun run examples/contacts.ts
bun run examples/domains.ts
bun run examples/email-status.ts <transactionId> [messageId]
bun run examples/webhooks.ts
bun run examples/inbound.ts
bun run examples/double-optin-subscribe.ts user@example.com "John Doe"
bun run examples/double-optin-webhook.ts
bun run examples/suppressions.ts
bun run examples/email-verification.ts user@example.com
bun run examples/statistics.ts
bun run examples/sub-accounts.ts
```

### JavaScript
```bash
cd javascript
bun run examples/basic-send.js
bun run examples/batch-send.js
bun run examples/with-attachments.js
bun run examples/with-cid-attachments.js
bun run examples/with-template.js
bun run examples/scheduled-send.js
bun run examples/prevent-threading.js
bun run examples/contacts.js
bun run examples/domains.js
bun run examples/email-status.js <transactionId> [messageId]
bun run examples/webhooks.js
bun run examples/inbound.js
bun run examples/double-optin-subscribe.js user@example.com "John Doe"
bun run examples/double-optin-webhook.js
bun run examples/suppressions.js
bun run examples/email-verification.js user@example.com
bun run examples/statistics.js
bun run examples/sub-accounts.js
```

## Bun Application

The server uses `Bun.serve()` with a `fetch` handler and routes on `new URL(req.url).pathname`.

### TypeScript
```bash
cd typescript
bun run dev

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Bun!"}'
```

### JavaScript
```bash
cd javascript
bun run dev

# Same curl commands work
```

## API Endpoints

- `GET /health` - Health check
- `POST /send` - Send a transactional email
- `GET|POST /webhook` - Handle Elastic Email event notifications (signed, or `?token=...`)
- `POST /inbound?token=...` - Receive inbound email pushed by an inbound route
- `POST /double-optin/subscribe` - Store a contact and send a confirmation email
- `GET /double-optin/confirm?email=...&token=...` - Add the contact to the list
- `GET|POST /double-optin/webhook` - Confirm via Clicked event instead of a link (signed, or `?token=...`)

## Webhooks and inbound

Create the webhook with `EnableSigning: true` and `DeliveryMethod: WebhookDeliveryMethod.PostJson`
(see `examples/webhooks.ts`). Elastic Email then sends each event as a POST with a flat JSON body:
`status` (Sent, Opened, Clicked, Error, AbuseReport, Unsubscribed), `to`, `from`, `transaction`,
`messageid`, `category`, `target`, ... (`to`, `from`, `channel`, `subject` and `messageid` may be
null). Each request is signed: `X-ElasticEmail-Signature: v1=<hex>` is the HMAC-SHA256, keyed with
the webhook's signing secret, of `{X-ElasticEmail-Timestamp}\n{METHOD}\n{path and query as received}\n{raw body}`.
The `SigningSecret` (`whsec_...`) is returned only when the webhook is created or its secret
rotated; store it as `ELASTICEMAIL_WEBHOOK_SECRET`. With it set, the handlers verify the signature
over the raw body (the handler reads `req.text()` before parsing JSON and takes the request target from `new URL(req.url)` (`pathname + search`)), reject timestamps more than 5 minutes
off and answer 401 otherwise, so Elastic Email retries. Signing and delivery method can't be changed
after creation, and signed or POST webhooks don't follow redirects.

Unsigned webhooks still work: leave `ELASTICEMAIL_WEBHOOK_SECRET` empty and append
`?token=ELASTICEMAIL_WEBHOOK_TOKEN` to the webhook URL; the handlers then check the token with a
constant-time compare. Unsigned events arrive as a GET with the same fields in the query string.

Inbound email arrives as a POST with form fields (`from_email`, `subject`, `body_text`, `body_html`,
`att1_name`, `att1_content`, ...), which the handler reads with `req.formData()`. The domain's MX record must point at `mx.inbound.elasticemail.com`.

For local development expose the server with a tunnel such as ngrok and set `PUBLIC_URL` to it.
When you save a webhook, Elastic Email sends one test event to the URL and saves the webhook only
if it gets a 2xx response. A signed webhook's test event arrives before your server knows the
secret, so a 401 or 403 answer to it is accepted as well. The test event carries sample values (`to=test@test.com`,
`messageid=abc1234`). The handlers accept it like any other event; in your own app, skip it before
it reaches your data.

## Quick Usage

```typescript
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: ["you@yourdomain.com"] },
  Content: {
    From: "Acme <hello@yourdomain.com>",
    Subject: "Hello",
    Body: [{ ContentType: "HTML", Content: "<p>Hello World</p>" }],
  },
});

console.log("Transaction ID:", data.TransactionID);
```

## Project Structure

```
bun-elasticemail-examples/
├── typescript/
│   ├── examples/                    # 18 standalone examples
│   ├── src/index.ts                 # Bun.serve() app
│   ├── package.json
│   └── tsconfig.json
├── javascript/
│   ├── examples/                    # 18 standalone examples
│   ├── src/index.js                 # Bun.serve() app
│   └── package.json
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)
- [Bun documentation](https://bun.sh/docs)

## License

MIT
