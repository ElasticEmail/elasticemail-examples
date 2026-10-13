# Send Email from Encore.ts - Elastic Email API

An Encore.ts service that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API: a typed `POST /send` endpoint, a raw `GET|POST /webhook` endpoint for Elastic Email notifications and `GET /health`. Secrets are managed by Encore rather than `.env` files.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.4.0` · Node.js 20+ (Encore 1.45) · Encore.ts

## Prerequisites

- Node.js 20+
- [Encore CLI](https://encore.dev/docs/ts/install): `curl -L https://encore.dev/install.sh | bash` (or `brew install encoredev/tap/encore`)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
encore auth login
encore app init      # links this folder to a new Encore app and fills encore.app
```

Set `EMAIL_FROM` in your shell (or hardcode a verified sender in `email/send.ts`); it is not sensitive so it is read from `process.env`.

## Secrets

```bash
encore secret set --type dev,local,pr,prod ElasticEmailApiKey
encore secret set --type dev,local,pr,prod ElasticEmailWebhookToken
encore secret set --type dev,local,pr,prod ElasticEmailWebhookSecret   # after creating a signed webhook
```

Encore prompts for the value and stores it encrypted per environment. In code they are read with `secret("ElasticEmailApiKey")()`.

`ElasticEmailWebhookSecret` is the `SigningSecret` (`whsec_...`) returned once when you create the webhook with `EnableSigning: true` and `DeliveryMethod: PostJson` (see [Webhooks](../README.md#webhooks)); it plays the role of `ELASTICEMAIL_WEBHOOK_SECRET` in the other folders. It is optional: while it is not set, `/webhook` falls back to the `?token=` check (`ElasticEmailWebhookToken`) for unsigned webhooks.

## Deploy

```bash
encore run                 # local, http://localhost:4000 (dashboard at http://localhost:9400)

git add -A && git commit -m "Elastic Email example"
git push encore            # deploys to Encore Cloud; the URL is printed in the dashboard
```

Self-hosting: `encore build docker elasticemail:latest` produces a container image; see the Encore docs for wiring secrets in that mode.

## Test with curl

```bash
URL=http://localhost:4000   # or https://<env>-<app>.encr.app

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Encore!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

That last request only works while `ElasticEmailWebhookSecret` is not set. With a signing secret set, send a signed request as shown in [Webhooks](../README.md#webhooks).

The local dashboard at http://localhost:9400 shows traces, including the outgoing call to `api.elasticemail.com`.

## Notes on runtime quirks

- `POST /send` takes an optional `Idempotency-Key` request header: it is forwarded to Elastic Email (a new key is generated otherwise), so clients can retry safely with the same key. It is declared as `idempotencyKey?: Header<"Idempotency-Key">` in the request type, so Encore reads it from the header rather than the JSON body.
- `api()` endpoints take and return typed JSON. Errors must be thrown as `APIError` (`invalidArgument`, `permissionDenied`, `internal`, ...); the code maps the Elastic Email HTTP status onto those codes, so the response shape is Encore's `{ code, message }` rather than `{ error }`.
- The webhook is an `api.raw` endpoint that receives Node's `IncomingMessage`/`ServerResponse`, because the signature covers the raw body and the raw request target, which the typed `api()` does not expose. It reads the body stream into a `Buffer` before parsing and signs `req.url`, the path + query exactly as it appeared on the request line. Signed webhooks with JSON delivery send POST; unsigned ones send GET with the event in the query string.
- Reading a secret that is not set throws, so the optional `ElasticEmailWebhookSecret` is read through a small `optionalSecret()` wrapper.
- `secret()` returns a function; call it at request time, not at module load, so `encore run` starts even when a secret is missing and the error surfaces on the first request.
- Encore generates `encore.gen/` on `encore run`; it is gitignored. The `~encore/*` path alias in `tsconfig.json` points there.

## AI assistant prompt

```
Write an Encore.ts service (email/encore.service.ts, email/send.ts) that sends email with Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x). Read the API key with
`const elasticEmailApiKey = secret("ElasticEmailApiKey")` from encore.dev/config and call it at request
time; set it with `encore secret set`. Never hardcode keys. Create `new Configuration({ apiKey })` and
`new EmailsApi(configuration)`. Define `api({ method: "POST", path: "/send", expose: true }, ...)` taking
{ to, subject, message } and calling emailsApi.emailsTransactionalPost with Recipients.To = [to] and
Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }. The From address must be a sender
Forward an incoming Idempotency-Key header as the second argument of emailsTransactionalPost (a new UUID if absent).
verified in Elastic Email. Return { success, transactionId, messageId } from response.data and throw
APIError with the mapped code on failure (err.response.data.Error). Add GET /health and an `api.raw`
endpoint for POST|GET /webhook that verifies the Elastic Email signature when the optional secret("ElasticEmailWebhookSecret") is set:
X-ElasticEmail-Signature holds comma-separated v1=<hex> entries, each the hex HMAC-SHA256 (node:crypto, key = the
secret) of `${X-ElasticEmail-Timestamp}\n${method}\n${req.url}\n${raw body}`, with the raw body read before
parsing; reject timestamps older than 300 s, compare in constant time, answer 401 on failure, then read the event
from the JSON body (POST) or the query (GET). Without the secret it checks ?token= against
secret("ElasticEmailWebhookToken") with crypto.timingSafeEqual and parses form-encoded bodies with URLSearchParams. Log the status field.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Encore.ts docs](https://encore.dev/docs/ts)
- [Encore.ts raw endpoints](https://encore.dev/docs/ts/primitives/raw-endpoints)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
