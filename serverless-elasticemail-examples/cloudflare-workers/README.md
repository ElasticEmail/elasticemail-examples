# Send Email from Cloudflare Workers - Elastic Email API

Send transactional email and receive webhooks from a Cloudflare Worker using the [Elastic Email](https://elasticemail.com/email-api) email API. The SDK runs on the Workers runtime through an axios fetch adapter, with secrets stored in Wrangler rather than `.env`.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.3.0` · workerd (Wrangler 3) · Cloudflare Workers

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
wrangler secret put ELASTICEMAIL_WEBHOOK_SECRET   # after creating a signed webhook
```

`ELASTICEMAIL_WEBHOOK_SECRET` is the `SigningSecret` (`whsec_...`) returned once when you create the webhook with `EnableSigning: true` and `DeliveryMethod: PostJson` (see [Webhooks](../README.md#webhooks)). Set it after creating the webhook; while it is empty, `/webhook` falls back to the `?token=` check (`ELASTICEMAIL_WEBHOOK_TOKEN`) for unsigned webhooks.

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

# Simulate an unsigned Elastic Email webhook (token check)
curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

That last request only works while `ELASTICEMAIL_WEBHOOK_SECRET` is empty. With a signing secret set, send a signed request as shown in [Webhooks](../README.md#webhooks).

Watch logs with `wrangler tail`.

## Notes on runtime quirks

- workerd does not ship `node:http`, which axios uses by default. The code passes `axios.create({ adapter: "fetch" })` as the third argument of `new EmailsApi(configuration, basePath, axios)` so requests go through `fetch`.
- `nodejs_compat` is enabled so axios' Node-specific imports (`url`, `util`, `stream`) resolve during bundling.
- Env vars are not globals. They arrive as the second argument of `fetch(request, env)`, so the `EmailsApi` instance is created per request.
- There is no `node:crypto` HMAC here, so the webhook signature is checked with WebCrypto (`crypto.subtle.importKey` + `sign`). The handler reads `await request.text()` before parsing JSON and signs `pathname + search` of `new URL(request.url)`, which keeps the percent-encoding.
- When you create a webhook, Elastic Email sends one test event (`to=test@test.com`, `messageid=abc1234`). An unsigned webhook is saved only if the Worker answers 2xx; for a signed one the Worker does not know the secret yet and answers 401, which Elastic Email accepts for that test.

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
(err.response.data.Error). Add GET /health and a POST|GET /webhook handler that verifies the Elastic Email signature when ELASTICEMAIL_WEBHOOK_SECRET is set:
X-ElasticEmail-Signature holds comma-separated v1=<hex> entries, each the hex HMAC-SHA256 (WebCrypto crypto.subtle, key = the
secret) of `${X-ElasticEmail-Timestamp}\n${method}\n${pathname + search of new URL(request.url)}\n${raw body}`, with the raw body read before
parsing; reject timestamps older than 300 s, compare in constant time, answer 401 on failure, then read the event
from the JSON body (POST) or the query (GET). Without the secret it checks ?token= against
env.ELASTICEMAIL_WEBHOOK_TOKEN. Log the status field. Use wrangler.toml with compatibility_flags = ["nodejs_compat"].
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
