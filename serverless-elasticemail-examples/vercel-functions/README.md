# Send Email from Vercel Functions - Elastic Email API

Send transactional email and receive webhooks from Vercel Functions using the [Elastic Email](https://elasticemail.com/email-api) email API. `api/send.ts` runs on the Node.js runtime, `api/send-edge.ts` does the same on the Edge runtime.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ and Edge runtime · Vercel Functions

## Prerequisites

- Node.js 20+ and a Vercel account
- `npm install -g vercel` (or use `npx vercel`)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp .env.example .env
vercel login
vercel link
```

## Secrets

```bash
vercel env add ELASTICEMAIL_API_KEY
vercel env add ELASTICEMAIL_WEBHOOK_TOKEN
vercel env add EMAIL_FROM
```

Choose the Production (and Preview) environments when prompted. `vercel env pull` writes them to `.env.local` for local runs.

## Deploy

```bash
npm run dev      # http://localhost:3000
npm run deploy   # prints the production URL
```

## Test with curl

```bash
URL=http://localhost:3000   # or your vercel.app URL

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Vercel!"}'

# Same request, Edge runtime
curl -X POST $URL/send-edge \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from the Edge!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

`vercel.json` rewrites `/send`, `/send-edge`, `/webhook` and `/health` to the matching `/api/*` function, so both paths work.

## Notes on runtime quirks

- Files in `api/` starting with `_` (like `api/_lib.ts`) are not deployed as functions; that is where the shared logic lives.
- The Node functions use the Web `Request`/`Response` signature (`export default async function handler(req: Request)`), which requires Node.js 20+ on Vercel. `export const config = { runtime: "nodejs" }` pins the runtime.
- The Edge function (`export const runtime = "edge"`) has no `node:http`, so `createEmailsApi(true)` passes `axios.create({ adapter: "fetch" })` as the third argument of `EmailsApi`.
- Function logs (`console.log` in the webhook handler) show up in the Vercel dashboard under Logs, or with `vercel logs <deployment-url>`.

## AI assistant prompt

```
Write Vercel Functions in TypeScript (api/send.ts, api/webhook.ts, api/health.ts) that send email with Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x). Read the API key from
process.env.ELASTICEMAIL_API_KEY set with `vercel env add`; never hardcode keys.
Create `new Configuration({ apiKey })` and `new EmailsApi(configuration)`. For an Edge runtime variant
(export const runtime = "edge") pass `axios.create({ adapter: "fetch" })` as the third constructor argument
because the Edge runtime has no node:http.
Use the Web signature `export default async function handler(req: Request): Promise<Response>`.
POST /send takes { to, subject, message } and calls emailsApi.emailsTransactionalPost with
Recipients.To = [to] and Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }.
The From address must be a sender verified in Elastic Email. Return { success, transactionId, messageId }
from response.data, and { error } with the API status on failure (err.response.data.Error).
GET|POST /webhook must check ?token= against process.env.ELASTICEMAIL_WEBHOOK_TOKEN and log the status field.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Vercel Functions docs](https://vercel.com/docs/functions)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
