# Hono Email API Examples - Elastic Email

Send transactional and bulk email from [Hono](https://hono.dev) on Node.js with the [Elastic Email](https://elasticemail.com/email-api) email API. The same handlers port to Cloudflare Workers, Bun and Deno with only the adapter changed. TypeScript and JavaScript variants are included.

> **First time here?** The [Hono quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)

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
- `POST /send` - Send a transactional email
- `GET|POST /webhook?token=...` - Handle Elastic Email event notifications
- `POST /inbound?token=...` - Receive inbound email pushed by an inbound route
- `POST /double-optin/subscribe` - Store a contact and send a confirmation email
- `GET /double-optin/confirm?email=...&token=...` - Add the contact to the list
- `POST /double-optin/webhook?token=...` - Confirm via Clicked event instead of a link

## Webhooks and inbound

Elastic Email does not sign webhook requests. The examples put a shared secret in the URL
(`?token=ELASTICEMAIL_WEBHOOK_TOKEN`) and check it with a constant-time compare.
Event parameters arrive in the query string or as form fields: `status` (Sent, Opened, Clicked,
Error, AbuseReport, Unsubscribed), `to`, `transaction`, `messageid`, `category`, `target`.
The handlers read form bodies with `c.req.parseBody()`.

Inbound email arrives as form fields (`from_email`, `subject`, `body_text`, `body_html`,
`att1_name`, `att1_content`, ...). The domain's MX record must point at `mx.inbound.elasticemail.com`.

For local development expose the server with a tunnel such as ngrok and set `PUBLIC_URL` to it.
Elastic Email sends a GET to the URL when a webhook is saved and expects a 2xx response.

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
