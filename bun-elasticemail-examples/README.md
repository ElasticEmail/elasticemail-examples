# Bun Email API Examples - Elastic Email

Send transactional and bulk email from [Bun](https://bun.sh) with the [Elastic Email](https://elasticemail.com/email-api) email API. Everything runs on `Bun.serve()` and Bun's built-in `.env` loading - no bundler, no extra tooling. TypeScript and JavaScript variants are included.

> **First time here?** The [Bun quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Bun 1.1+ · Bun.serve()

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
- `GET|POST /webhook?token=...` - Handle Elastic Email event notifications
- `POST /inbound?token=...` - Receive inbound email pushed by an inbound route
- `POST /double-optin/subscribe` - Store a contact and send a confirmation email
- `GET /double-optin/confirm?email=...&token=...` - Add the contact to the list
- `POST /double-optin/webhook?token=...` - Confirm via Clicked event instead of a link

## Webhooks and inbound

Elastic Email does not sign webhook requests. The examples put a shared secret in the URL
(`?token=ELASTICEMAIL_WEBHOOK_TOKEN`) and check it with a constant-time compare from `node:crypto`,
which Bun supports.
Elastic Email sends each event as a GET request with the details in the query string: `status`
(Sent, Opened, Clicked, Error, AbuseReport, Unsubscribed), `to`, `transaction`, `messageid`,
`category`, `target`.

Inbound email arrives as a POST with form fields (`from_email`, `subject`, `body_text`, `body_html`,
`att1_name`, `att1_content`, ...), which the handler reads with `req.formData()`. The domain's MX record must point at `mx.inbound.elasticemail.com`.

For local development expose the server with a tunnel such as ngrok and set `PUBLIC_URL` to it.
When you save a webhook, Elastic Email sends one test event to the URL and saves the webhook only
if it gets a 2xx response. The test event carries sample values (`to=test@test.com`,
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
