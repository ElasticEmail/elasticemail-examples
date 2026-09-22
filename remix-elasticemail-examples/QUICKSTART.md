# Send your first email with Remix

Five minutes from a clean clone to a delivered email, using Remix 2 resource routes and the Elastic
Email TypeScript SDK.

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
cd elasticemail-examples/remix-elasticemail-examples

cp .env.example typescript/.env   # or javascript/.env
cd typescript                     # or javascript
npm install
```

In a project of your own:

```bash
npm install @elasticemail/elasticemail-client-ts-axios
```

## 4. Set your environment variables

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
PUBLIC_URL=http://localhost:5173
```

Full list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

`app/routes/api.send.ts` - a resource route, so it exports an `action` and no component:

```typescript
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { apiError, emailsApi, from, readJson } from "../lib/elasticemail.server";

export async function action({ request }: ActionFunctionArgs) {
  const { to, subject, message } = await readJson(request);

  if (!to || !subject || !message) {
    return json({ error: "Missing required fields: to, subject, message" }, { status: 400 });
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
    return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, { status });
  }
}
```

The `.server.ts` suffix on `app/lib/elasticemail.server.ts` is what guarantees the module - and the
API key with it - never reaches a client bundle.

## 6. Run it

```bash
npm run dev
```

```bash
curl -X POST http://localhost:5173/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from Remix"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## 7. Open the example app

http://localhost:5173 has a page per feature. The pages submit to the same resource routes with
`useFetcher`, so anything the UI does, curl can do too.

Production build: `npm run build && npm start` (port 3000 by default).

## Next steps

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Build a signup that confirms by email | [Double opt-in](../docs/double-opt-in.md) |
| Every route and file | [README.md](README.md) |
