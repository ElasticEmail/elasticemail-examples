# Send Email from Netlify Functions - Elastic Email API

Netlify Functions 2.0 (`.mts`, Web `Request`/`Response`) that send transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API, with `/send`, `/webhook` and `/health`, plus an Edge Function variant of the send endpoint at `/send-edge`.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

## Prerequisites

- Node.js 20+ and a Netlify account
- `npm install -g netlify-cli` (also included as a devDependency)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)

## Setup

```bash
npm install
cp .env.example .env
netlify login
netlify init      # or netlify link
```

## Secrets

```bash
netlify env:set ELASTICEMAIL_API_KEY your_api_key
netlify env:set ELASTICEMAIL_WEBHOOK_TOKEN change_me
netlify env:set EMAIL_FROM "Acme <hello@yourdomain.com>"
# or all at once from the local file
netlify env:import .env
```

## Deploy

```bash
npm run dev      # http://localhost:8888
npm run deploy   # netlify deploy --prod
```

## Test with curl

```bash
URL=http://localhost:8888   # or https://<site>.netlify.app

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Netlify!"}'

# Edge Function variant
curl -X POST $URL/send-edge \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from the Edge!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

Logs: `netlify logs:function send` or the Functions tab in the dashboard.

## Notes on runtime quirks

- Functions 2.0 use `export default async (req: Request, context: Context)` and `export const config = { path: "/send" }` for custom routes; the old `/.netlify/functions/<name>` URL still works.
- Files use the `.mts` extension so Netlify treats them as ESM regardless of `package.json`. The shared code in `netlify/shared.ts` is imported by both the Node functions and the Edge function.
- Edge Functions run on Deno. They read env vars from `Netlify.env.get(...)` (not `process.env`) and need `axios.create({ adapter: "fetch" })` passed as the third argument of `EmailsApi`. npm packages resolve through Netlify's bundler; keep the `axios` dependency in `package.json`.
- The Edge import uses the `.ts` extension (`../shared.ts`) because Deno requires explicit extensions. `tsconfig.json` sets `allowImportingTsExtensions` and excludes the edge folder from `tsc` since its `Netlify` global comes from the Deno types.
- `netlify.toml` needs a `publish` directory even for an API-only site; `public/index.html` is a placeholder.

## AI assistant prompt

```
Write Netlify Functions 2.0 in TypeScript (netlify/functions/send.mts, webhook.mts, health.mts) that send email
with Elastic Email. Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x).
Read the API key from process.env.ELASTICEMAIL_API_KEY set with `netlify env:set`; never hardcode keys.
Create `new Configuration({ apiKey })` and `new EmailsApi(configuration)`. For an Edge Function variant
(netlify/edge-functions/send-edge.ts) read Netlify.env.get("ELASTICEMAIL_API_KEY") and pass
`axios.create({ adapter: "fetch" })` as the third constructor argument because Deno has no node:http.
Use `export default async (req: Request, context: Context)` and `export const config = { path: "/send" }`.
POST /send takes { to, subject, message } and calls emailsApi.emailsTransactionalPost with
Recipients.To = [to] and Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }.
The From address must be a sender verified in Elastic Email. Return { success, transactionId, messageId }
from response.data, and { error } with the API status on failure (err.response.data.Error).
GET|POST /webhook checks ?token= against ELASTICEMAIL_WEBHOOK_TOKEN with a constant-time compare and logs
the status field.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Netlify Functions docs](https://docs.netlify.com/functions/overview/)
- [Netlify Edge Functions docs](https://docs.netlify.com/edge-functions/overview/)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
