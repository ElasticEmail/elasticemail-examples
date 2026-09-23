# Send your first email with Bun

Five minutes from a clean clone to a delivered email, using `Bun.serve()` and the Elastic Email
TypeScript SDK. No build step and no dotenv package - Bun runs TypeScript directly and loads `.env`
on its own.

## Prerequisites

- [Bun](https://bun.sh) 1.0+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

Creating and managing keys is covered in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/bun-elasticemail-examples/typescript   # or javascript

bun install
cp ../.env.example .env
```

In a project of your own:

```bash
bun add @elasticemail/elasticemail-client-ts-axios
```

## 4. Set your environment variables

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

Bun loads `.env` into `process.env` on startup - no `dotenv` import anywhere. Full list in
[docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

```typescript
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: [process.env.EMAIL_TO!] },
  Content: {
    From: process.env.EMAIL_FROM!,
    Subject: "Hello from Elastic Email!",
    Body: [
      { ContentType: "HTML", Content: "<h1>Welcome!</h1><p>Sent from Bun.</p>" },
      { ContentType: "PlainText", Content: "Welcome! Sent from Bun." },
    ],
  },
});

console.log("Transaction ID:", data.TransactionID);
```

Run it straight from the file, no compile step:

```bash
bun run examples/basic-send.ts     # TypeScript
bun run examples/basic-send.js     # JavaScript
```

## 6. Or run the server

The app uses `Bun.serve()` with a single `fetch` handler that routes on
`new URL(req.url).pathname`.

```bash
bun run dev
```

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Bun!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## Next steps

18 standalone examples live in `examples/`:

```bash
bun run examples/batch-send.ts        # one call, personalized per recipient
bun run examples/with-attachments.ts  # base64 file attachment
bun run examples/with-template.ts     # hosted template + merge values
bun run examples/webhooks.ts          # create, list, delete a webhook
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Handle API failures properly | [Error handling](../docs/error-handling.md) |
| Every example and route | [README.md](README.md) |
