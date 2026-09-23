# Send your first email with Nuxt

Five minutes from a clean clone to a delivered email, using Nuxt 3 server routes (Nitro) and the
Elastic Email TypeScript SDK.

## Prerequisites

- Node.js 20+
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
cd elasticemail-examples/nuxt-elasticemail-examples

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
```

Nuxt loads `.env` for `nuxt dev` and `nuxt build`. For `node .output/server/index.mjs` export the
variables yourself. Full list in
[docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

`server/api/send.post.ts`:

```typescript
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

export default defineEventHandler(async (event) => {
  const { to, subject, message } = await readBody(event);

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: process.env.EMAIL_FROM!,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return { success: true, transactionId: data.TransactionID, messageId: data.MessageID };
  } catch (err: any) {
    setResponseStatus(event, err.response?.status ?? 500);
    return { error: err.response?.data?.Error ?? err.message };
  }
});
```

Anything under `server/` stays on the server, so the API key never reaches the browser. The shared
setup lives in `server/utils/elasticemail.ts`, which Nuxt auto-imports.

## 6. Run it

```bash
npm run dev
```

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from Nuxt"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## 7. Open the example app

http://localhost:3000 has a page per feature, each calling one of the server routes with `$fetch`.

## Next steps

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Build a signup that confirms by email | [Double opt-in](../docs/double-opt-in.md) |
| Every route and file | [README.md](README.md) |
