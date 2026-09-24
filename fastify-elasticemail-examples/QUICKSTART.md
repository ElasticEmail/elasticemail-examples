# Send your first email with Fastify

Five minutes from a clean clone to a delivered email, using a Fastify 5 server on Node.js and the
Elastic Email TypeScript SDK (`@elasticemail/elasticemail-client-ts-axios`).

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
cd elasticemail-examples/fastify-elasticemail-examples/typescript   # or javascript

npm install
cp ../.env.example .env
```

In a project of your own:

```bash
npm install fastify @fastify/formbody @elasticemail/elasticemail-client-ts-axios dotenv
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

The shortest possible version - this is `examples/basic-send.ts`:

```typescript
import "dotenv/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: [process.env.EMAIL_TO!] },
  Content: {
    From: process.env.EMAIL_FROM!,
    Subject: "Hello from Elastic Email!",
    Body: [
      { ContentType: "HTML", Content: "<h1>Welcome!</h1><p>Sent from Fastify.</p>" },
      { ContentType: "PlainText", Content: "Welcome! Sent from Fastify." },
    ],
  },
});

console.log("Transaction ID:", data.TransactionID);
```

Run it:

```bash
npx tsx examples/basic-send.ts     # TypeScript
node examples/basic-send.js        # JavaScript
```

## 6. Or run the server

```bash
npm run dev
```

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Fastify!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

The route in `src/index.ts`:

```typescript
app.post("/send", async (req, reply) => {
  const { to, subject, message } = (req.body ?? {}) as Fields;
  if (!to || !subject || !message) {
    return reply.status(400).send({ error: "Missing required fields: to, subject, message" });
  }

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return { success: true, transactionId: data.TransactionID, messageId: data.MessageID };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return reply.status(status).send({ error });
  }
});
```

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
