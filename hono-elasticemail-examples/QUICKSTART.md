# Send your first email with Hono

Five minutes from a clean clone to a delivered email, using Hono and the Elastic Email TypeScript
SDK. The same code runs on Node, Bun, Deno, Cloudflare Workers and Vercel - see the note at the end.

## Prerequisites

- Node.js 20+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/hono-elasticemail-examples/typescript   # or javascript

npm install
cp ../.env.example .env
```

In a project of your own:

```bash
npm install hono @hono/node-server @elasticemail/elasticemail-client-ts-axios dotenv
```

## 4. Set your environment variables

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

Full list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));
const app = new Hono();

app.post("/send", async (c) => {
  const { to, subject, message } = await c.req.json();

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: process.env.EMAIL_FROM!,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return c.json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err: any) {
    return c.json(
      { error: err.response?.data?.Error ?? err.message },
      err.response?.status ?? 500,
    );
  }
});

serve({ fetch: app.fetch, port: 3000 });
```

## 6. Run it

```bash
npm run dev
```

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Hono!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

Or skip the server entirely - the 18 scripts in `examples/` do not depend on Hono:

```bash
npx tsx examples/basic-send.ts     # TypeScript
node examples/basic-send.js        # JavaScript
```

## Running on an edge runtime

Cloudflare Workers, Deno and Vercel Edge have no `node:http`, which axios reaches for by default.
Hand the SDK a fetch-based axios instance instead:

```typescript
import axios from "axios";
const emailsApi = new EmailsApi(config, undefined, axios.create({ adapter: "fetch" }));
```

On Workers, environment variables are not globals either - they arrive as `c.env`, so build the
client inside the handler. The
[serverless examples](../serverless-elasticemail-examples/) cover this per platform.

## Next steps

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Deploy to an edge platform | [Serverless examples](../serverless-elasticemail-examples/) |
| Every example and route | [README.md](README.md) |
