# Send your first email with RedwoodJS

Five minutes from a clean clone to a delivered email, using RedwoodJS 8 serverless functions and the
Elastic Email TypeScript SDK.

## Prerequisites

- Node.js 20+ and Yarn
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
cd elasticemail-examples/redwoodjs-elasticemail-examples

cp .env.example typescript/.env   # or javascript/.env
cd typescript                     # or javascript
yarn install
```

In a project of your own:

```bash
yarn workspace api add @elasticemail/elasticemail-client-ts-axios
```

The dependency belongs to the `api` side. Adding it to `web` would put an API client - and the
temptation to use a key there - into the browser bundle.

## 4. Set your environment variables

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
PUBLIC_URL=http://localhost:8910
```

Redwood loads `.env` from the project root for both sides. Full list in
[docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

`api/src/functions/send.ts` - functions receive an API Gateway style `event`, so the JSON body comes
off `event.body` as a string:

```typescript
import type { APIGatewayEvent } from "aws-lambda";
import { emailsApi, from, apiError } from "src/lib/elasticemail";

export const handler = async (event: APIGatewayEvent) => {
  const { to, subject, message } = JSON.parse(event.body ?? "{}");

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, transactionId: data.TransactionID, messageId: data.MessageID }),
    };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return { statusCode: status, body: JSON.stringify({ error }) };
  }
};
```

Webhook and inbound notifications arrive form-encoded, not as JSON; `api/src/lib/elasticemail.ts`
parses those with `URLSearchParams`.

## 6. Run it

```bash
yarn rw dev
```

The web side proxies `/.redwood/functions/*` to the API server on port 8911, so one URL works from
the browser and from curl:

```bash
curl -X POST http://localhost:8910/.redwood/functions/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from RedwoodJS"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## 7. Open the example app

http://localhost:8910 has a page per feature, each posting to one of the functions.

When you register a webhook or inbound route, the URL is
`PUBLIC_URL/.redwood/functions/webhook?token=...` - note the `.redwood/functions` prefix.

## Next steps

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Build a signup that confirms by email | [Double opt-in](../docs/double-opt-in.md) |
| Every function and page | [README.md](README.md) |
