# Serverless Email API Examples - Elastic Email

Send email with the [Elastic Email](https://elasticemail.com/email-api) email API from serverless and edge platforms - Cloudflare Workers, Vercel, Netlify, AWS Lambda, Supabase Edge Functions, Deno Deploy, Encore.ts, Railway, Firebase Cloud Functions, Azure Functions, Google Cloud Run and Convex. Each folder is a standalone deployable project with three endpoints:

- `GET /health` -> `{ status: "ok" }`
- `POST /send` body `{ to, subject, message }` -> transactional send -> `{ success, transactionId, messageId }`; an optional `Idempotency-Key` request header is forwarded to Elastic Email (a new key is generated otherwise), so clients can retry safely with the same key
- `POST|GET /webhook` -> Elastic Email event handler (HMAC signature check, or `?token=` for unsigned webhooks; logs `status`)

All of them use the npm package `@elasticemail/elasticemail-client-ts-axios`. On runtimes without Node's `http` module (Cloudflare Workers, Vercel Edge, Netlify Edge, Deno, Supabase) the SDK is given an axios instance created with `axios.create({ adapter: "fetch" })`. Keep the top-level `axios` dependency on the same range the SDK uses (`~1.18.0`) so npm dedupes it and the types line up.

> **First time here?** The [serverless quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Node.js 20+ (or Deno / Bun where noted)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))
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
| [firebase-functions](firebase-functions/) | Node.js 20 (firebase-functions 6) | `src/index.ts` | `firebase deploy --only functions` |
| [azure-functions](azure-functions/) | Node.js 20 (Azure Functions v4) | `src/functions/*.ts` | `func azure functionapp publish <app>` |
| [google-cloud-run](google-cloud-run/) | Node.js 20 (container, Hono) | `src/index.ts` | `gcloud run deploy --source .` |
| [convex](convex/) | Convex (Node.js actions) | `convex/http.ts` | `npx convex deploy` |

## Environment variables

Every platform needs the same values; only the way you set them differs (see each README's Secrets section).

```
ELASTICEMAIL_API_KEY        API key
EMAIL_FROM                  verified sender, e.g. Acme <hello@yourdomain.com>
EMAIL_TO                    test recipient
ELASTICEMAIL_WEBHOOK_SECRET signing secret (whsec_...) returned when the webhook is created with EnableSigning
ELASTICEMAIL_WEBHOOK_TOKEN  shared secret appended to the webhook URL as ?token= (unsigned webhooks only)
```

Copy `.env.example` to `.env` inside the folder you are working on for local development.

## Webhooks

Create the webhook with `EnableSigning: true` and `DeliveryMethod: PostJson` (both are fixed at creation). Elastic Email then POSTs each event as a flat JSON object (`status`, `to`, `from`, `transaction`, `messageid`, `category`, `channel`, `subject`, `target`, `date`, `ip`, `country`, `city`, ...; `to`, `from`, `channel`, `subject` and `messageid` may be `null`) and signs it with three headers:

- `X-ElasticEmail-Timestamp`: unix seconds
- `X-ElasticEmail-Signature`: `v1=<hex>`, a comma-separated list; accept the request if any `v1=` entry matches
- `X-ElasticEmail-Webhook-Id`

The signature is the lowercase hex HMAC-SHA256, keyed with the signing secret, of `{timestamp}\n{METHOD}\n{path + query}\n{raw body}`. The path and query are taken exactly as they were requested, still URL-encoded, and the body is the raw bytes, so every handler reads the raw body before parsing JSON. Each platform folder has a small `verifySignature` helper: `node:crypto` where it is available, WebCrypto (`crypto.subtle`) on Workers, Deno, Supabase, Convex, Vercel and Netlify. It rejects timestamps more than 300 seconds old and compares in constant time. When `ELASTICEMAIL_WEBHOOK_SECRET` is set, `/webhook` requires a valid signature and answers 401 otherwise, which makes Elastic Email retry.

Unsigned webhooks still work: leave `ELASTICEMAIL_WEBHOOK_SECRET` empty and the handlers fall back to a shared secret in the URL (`?token=ELASTICEMAIL_WEBHOOK_TOKEN`), compared in constant time. Unsigned webhooks send each event as a GET with the same fields in the query string.

The create response contains `SigningSecret` (`whsec_...`) and it is shown only this once. Store it as `ELASTICEMAIL_WEBHOOK_SECRET`. If you lose it, rotate it with `webhookByPublicidSecretRotatePost(publicId)`; the old secret stops working immediately, with no grace period.

```typescript
import { Configuration, WebhookApi, WebhookDeliveryMethod } from "@elasticemail/elasticemail-client-ts-axios";

const { data } = await new WebhookApi(config).webhookPost({
  Name: "serverless-example",
  URL: "https://<your-deployment>/webhook", // no ?token= needed
  EnableSigning: true,
  DeliveryMethod: WebhookDeliveryMethod.PostJson,
  NotificationForSent: true,
  NotificationForOpened: true,
  NotificationForClicked: true,
  NotificationForError: true,
});
console.log("Store as ELASTICEMAIL_WEBHOOK_SECRET (shown only once):", data.SigningSecret);
```

Elastic Email sends one test event when you create the webhook. For a signed webhook it arrives before your endpoint has the secret, so the handler answers 401; Elastic Email accepts 401 or 403 for that test and still creates the webhook. Deploy first, create the webhook, then set `ELASTICEMAIL_WEBHOOK_SECRET` and redeploy (or restart). Unsigned webhooks are saved only if the test event gets a 2xx, which the `?token=` handlers return. The test event carries sample values (`to=test@test.com`, `messageid=abc1234`); in your own app, skip it before it reaches your data. Signed and POST webhooks do not follow redirects, so register the final URL.

Send a signed test request yourself:

```bash
SECRET=whsec_...   # your ELASTICEMAIL_WEBHOOK_SECRET
TS=$(date +%s)
BODY='{"status":"Sent","to":"you@yourdomain.com","transaction":"abc","messageid":"xyz"}'
SIG=$(printf '%s\nPOST\n/webhook\n%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)
curl -X POST "$URL/webhook" -H "Content-Type: application/json" \
  -H "X-ElasticEmail-Timestamp: $TS" -H "X-ElasticEmail-Signature: v1=$SIG" -d "$BODY"
```

The path in the signed string is the path of the URL you call (for example `/functions/v1/webhook` on Supabase, `/api/webhook` on the Firebase `cloudfunctions.net` URL).

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
