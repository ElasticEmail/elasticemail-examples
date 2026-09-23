# Send Email from Cloudflare Workers - Elastic Email API

Send transactional email and receive webhooks from a Cloudflare Worker using the [Elastic Email](https://elasticemail.com/email-api) email API. The SDK runs on the Workers runtime through an axios fetch adapter, with secrets stored in Wrangler rather than `.env`.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

## Prerequisites

- Node.js 20+ and a Cloudflare account
- `npm install -g wrangler` (or use `npx wrangler`)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars   # local secrets for wrangler dev
wrangler login
```

Edit `EMAIL_FROM` in `wrangler.toml` (or `.dev.vars` for local runs).

## Secrets

```bash
wrangler secret put ELASTICEMAIL_API_KEY
wrangler secret put ELASTICEMAIL_WEBHOOK_TOKEN
```

## Deploy

```bash
npm run dev      # http://localhost:8787
npm run deploy   # prints https://elasticemail-worker.<subdomain>.workers.dev
```

## Test with curl

```bash
URL=http://localhost:8787   # or your workers.dev URL

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Workers!"}'

# Simulate an Elastic Email webhook (form-encoded, as EE sends it)
curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

Watch logs with `wrangler tail`.

## Notes on runtime quirks

- workerd does not ship `node:http`, which axios uses by default. The code passes `axios.create({ adapter: "fetch" })` as the third argument of `new EmailsApi(configuration, basePath, axios)` so requests go through `fetch`.
- `nodejs_compat` is enabled so axios' Node-specific imports (`url`, `util`, `stream`) resolve during bundling.
- Env vars are not globals. They arrive as the second argument of `fetch(request, env)`, so the `EmailsApi` instance is created per request.
- When you save a webhook, Elastic Email sends one test event (a GET with `to=test@test.com` and `messageid=abc1234`) and saves the webhook only if the Worker answers 2xx. The handler accepts it like any other event.

## AI assistant prompt

```
Write a Cloudflare Worker in TypeScript that sends email with Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x) together with axios.
Read the API key from env.ELASTICEMAIL_API_KEY (a Wrangler secret) and never hardcode keys.
Create `new Configuration({ apiKey: env.ELASTICEMAIL_API_KEY })` and
`new EmailsApi(configuration, undefined, axios.create({ adapter: "fetch" }))` because workerd has no node:http.
Expose POST /send that takes { to, subject, message } and calls emailsApi.emailsTransactionalPost with
Recipients.To = [to] and Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }.
The From address must be a sender verified in Elastic Email. Return { success, transactionId, messageId }
from response.data.TransactionID and response.data.MessageID, and { error } with the API status on failure
(err.response.data.Error). Add GET /health and a GET|POST /webhook handler that checks ?token= against
env.ELASTICEMAIL_WEBHOOK_TOKEN and logs the status field. Use wrangler.toml with compatibility_flags = ["nodejs_compat"].
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
