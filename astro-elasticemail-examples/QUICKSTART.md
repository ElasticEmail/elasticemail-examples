# Send your first email with Astro

Five minutes from a clean clone to a delivered email, using Astro 5 API routes and the Elastic Email
TypeScript SDK.

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
cd elasticemail-examples/astro-elasticemail-examples

cp .env.example typescript/.env   # or javascript/.env
cd typescript                     # or javascript
npm install
```

In a project of your own:

```bash
npm install @elasticemail/elasticemail-client-ts-axios @astrojs/node
```

The Node adapter matters. Sending happens on the server, so `astro.config.mjs` sets
`output: "server"`:

```javascript
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Elastic Email posts webhook and inbound notifications form-encoded without an Origin
  // header, which Astro's default CSRF check rejects. The handlers verify ?token= instead.
  security: { checkOrigin: false },
});
```

## 4. Set your environment variables

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
PUBLIC_URL=http://localhost:4321
```

Full list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

`src/pages/api/send.ts`:

```typescript
import type { APIRoute } from "astro";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

export const POST: APIRoute = async ({ request }) => {
  const { to, subject, message } = await request.json();

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: process.env.EMAIL_FROM!,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });

    return new Response(
      JSON.stringify({ success: true, transactionId: data.TransactionID, messageId: data.MessageID }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.response?.data?.Error ?? err.message }), {
      status: err.response?.status ?? 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

The example project builds the client lazily in `src/lib/elasticemail.ts`, so importing the module
during `astro build` does not throw when no `.env` is present.

## 6. Run it

```bash
npm run dev
```

```bash
curl -X POST http://localhost:4321/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from Astro"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## 7. Open the example app

http://localhost:4321 has a page per feature - plain `.astro` files with a small `<script>` that
posts JSON to the same endpoints you just called with curl.

## Production build

```bash
npm run build
node --env-file=.env dist/server/entry.mjs
```

The standalone Node server reads `process.env` only, so export the variables yourself or pass
`--env-file` as above.

## Next steps

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Build a signup that confirms by email | [Double opt-in](../docs/double-opt-in.md) |
| Every route and file | [README.md](README.md) |
