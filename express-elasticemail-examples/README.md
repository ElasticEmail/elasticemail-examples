# Express Email API Examples - Elastic Email

Send transactional and bulk email from Express 5 on Node.js with the [Elastic Email](https://elasticemail.com/email-api) email API. TypeScript and JavaScript variants are included, both built on the official Elastic Email TypeScript SDK.

> **First time here?** The [Express quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

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

## Express Application

### TypeScript
```bash
cd typescript
npm run dev

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Express!"}'
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
express-elasticemail-examples/
├── typescript/
│   ├── examples/                    # 18 standalone examples
│   ├── src/index.ts                 # Express app
│   ├── package.json
│   └── tsconfig.json
├── javascript/
│   ├── examples/                    # 18 standalone examples
│   ├── src/index.js                 # Express app
│   └── package.json
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
