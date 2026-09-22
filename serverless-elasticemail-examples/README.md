# Serverless Email API Examples - Elastic Email

Send email with the [Elastic Email](https://elasticemail.com/email-api) email API from serverless and edge platforms - Cloudflare Workers, Vercel, Netlify, AWS Lambda, Supabase Edge Functions, Deno Deploy, Encore.ts and Railway. Each folder is a standalone deployable project with three endpoints:

- `GET /health` -> `{ status: "ok" }`
- `POST /send` body `{ to, subject, message }` -> transactional send -> `{ success, transactionId, messageId }`
- `GET|POST /webhook?token=...` -> Elastic Email event handler (token check, logs `status`)

All of them use the npm package `@elasticemail/elasticemail-client-ts-axios`. On runtimes without Node's `http` module (Cloudflare Workers, Vercel Edge, Netlify Edge, Deno, Supabase) the SDK is given an axios instance created with `axios.create({ adapter: "fetch" })`. Keep the top-level `axios` dependency on the same range the SDK uses (`~1.18.0`) so npm dedupes it and the types line up.

> **First time here?** The [serverless quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Node.js 20+ (or Deno / Bun where noted)
- An Elastic Email account with a verified sender domain
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
- The platform CLI listed in each folder

## Platforms

| Folder | Runtime | Entry point | Deploy |
|---|---|---|---|
| [cloudflare-workers](cloudflare-workers/) | workerd (`nodejs_compat`) | `src/index.ts` | `wrangler deploy` |
| [vercel-functions](vercel-functions/) | Node.js and Edge | `api/*.ts` | `vercel deploy` |
| [supabase-edge-functions](supabase-edge-functions/) | Deno | `supabase/functions/*/index.ts` | `supabase functions deploy` |
| [aws-lambda](aws-lambda/) | Node.js 20 (SAM, HTTP API) | `src/handler.ts` | `sam build && sam deploy --guided` |
| [deno-deploy](deno-deploy/) | Deno | `main.ts` | `deployctl deploy` |
| [netlify-functions](netlify-functions/) | Node.js and Edge | `netlify/functions/*.mts` | `netlify deploy --prod` |
| [railway](railway/) | Node.js (Hono) | `src/index.ts` | `railway up` |
| [encore-ts](encore-ts/) | Node.js (Encore.ts) | `email/send.ts` | `encore run`, `git push encore` |

## Environment variables

Every platform needs the same values; only the way you set them differs (see each README's Secrets section).

```
ELASTICEMAIL_API_KEY      API key
EMAIL_FROM                verified sender, e.g. Acme <hello@yourdomain.com>
EMAIL_TO                  test recipient
ELASTICEMAIL_WEBHOOK_TOKEN shared secret appended to the webhook URL as ?token=
```

Copy `.env.example` to `.env` inside the folder you are working on for local development.

## Webhooks

Elastic Email does not sign webhook requests. The handlers check a shared secret in the URL (`?token=ELASTICEMAIL_WEBHOOK_TOKEN`) with a constant-time compare and return 401 on mismatch. Events arrive as query parameters (GET) or form fields (POST): `status` (Sent, Opened, Clicked, Error, AbuseReport, Unsubscribed), `to`, `transaction`, `messageid`, `category`, `target`. Elastic Email sends a GET to the URL when the webhook is saved and expects a 2xx response, so the handlers answer `{ ok: true }` to requests without a `status`.

Register the webhook in the Elastic Email dashboard or with the SDK:

```typescript
await new WebhookApi(config).webhookPost({
  Name: "serverless-example",
  URL: `https://<your-deployment>/webhook?token=${process.env.ELASTICEMAIL_WEBHOOK_TOKEN}`,
  NotificationForSent: true,
  NotificationForOpened: true,
  NotificationForClicked: true,
  NotificationForError: true,
});
```

## Quick Usage

```typescript
import axios from "axios";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
// The third argument is only needed on runtimes without Node's http module.
const emailsApi = new EmailsApi(config, undefined, axios.create({ adapter: "fetch" }));

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

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
