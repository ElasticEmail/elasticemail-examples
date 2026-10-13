# Hono Email API Examples - Elastic Email

Send transactional and bulk email from [Hono](https://hono.dev) on Node.js with the [Elastic Email](https://elasticemail.com/email-api) email API. The same handlers port to Cloudflare Workers, Bun and Deno with only the adapter changed. TypeScript and JavaScript variants are included.

> **First time here?** The [Hono quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.4.0` · Node.js 20+ · Hono 4

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

```bash
# Choose your variant
cd typescript  # or javascript

# Install dependencies
npm install

# Copy environment variables
cp ../.env.example .env

# Add your Elastic Email API key and sender address to .env
```

## Standalone Examples

The scripts in `examples/` do not depend on Hono, except `double-optin-webhook` which starts a small Hono server.

### TypeScript
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

### JavaScript
```bash
cd javascript
node examples/basic-send.js
node examples/batch-send.js
node examples/with-attachments.js
node examples/with-cid-attachments.js
node examples/with-template.js
node examples/scheduled-send.js
node examples/prevent-threading.js
node examples/contacts.js
node examples/domains.js
node examples/email-status.js <transactionId> [messageId]
node examples/webhooks.js
node examples/inbound.js
node examples/double-optin-subscribe.js user@example.com "John Doe"
node examples/double-optin-webhook.js
node examples/suppressions.js
node examples/email-verification.js user@example.com
node examples/statistics.js
node examples/sub-accounts.js
```

## Hono Application

### TypeScript
```bash
cd typescript
npm run dev

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Hono!"}'
```

### JavaScript
```bash
cd javascript
npm run dev

# Same curl commands work
```

## API Endpoints

- `GET /health` - Health check
- `POST /send` - Send a transactional email. An optional `Idempotency-Key` request header is forwarded to Elastic Email (a new key is generated otherwise), so clients can retry safely with the same key
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
over the raw body (the handler reads `c.req.text()` before parsing JSON and takes the request target from `new URL(c.req.url)` (`pathname + search`)), reject timestamps more than 5 minutes
off and answer 401 otherwise, so Elastic Email retries. Signing and delivery method can't be changed
after creation, and signed or POST webhooks don't follow redirects.

Unsigned webhooks still work: leave `ELASTICEMAIL_WEBHOOK_SECRET` empty and append
`?token=ELASTICEMAIL_WEBHOOK_TOKEN` to the webhook URL; the handlers then check the token with a
constant-time compare. Unsigned events arrive as a GET with the same fields in the query string.

Inbound email arrives as a POST with form fields (`from_email`, `subject`, `body_text`, `body_html`,
`att1_name`, `att1_content`, ...), which the handler reads with `c.req.parseBody()`. The domain's MX record must point at `mx.inbound.elasticemail.com`.

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
hono-elasticemail-examples/
├── typescript/
│   ├── examples/                    # 18 standalone examples
│   ├── src/index.ts                 # Hono app served with @hono/node-server
│   ├── package.json
│   └── tsconfig.json
├── javascript/
│   ├── examples/                    # 18 standalone examples
│   ├── src/index.js                 # Hono app
│   └── package.json
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)
- [Hono documentation](https://hono.dev/docs)

## License

MIT
