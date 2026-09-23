# Send Email from Encore.ts - Elastic Email API

An Encore.ts service that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API: a typed `POST /send` endpoint, a raw `GET|POST /webhook` endpoint for Elastic Email notifications and `GET /health`. Secrets are managed by Encore rather than `.env` files.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

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
```

Encore prompts for the value and stores it encrypted per environment. In code they are read with `secret("ElasticEmailApiKey")()`.

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

The local dashboard at http://localhost:9400 shows traces, including the outgoing call to `api.elasticemail.com`.

## Notes on runtime quirks

- `api()` endpoints take and return typed JSON. Errors must be thrown as `APIError` (`invalidArgument`, `permissionDenied`, `internal`, ...); the code maps the Elastic Email HTTP status onto those codes, so the response shape is Encore's `{ code, message }` rather than `{ error }`.
- Elastic Email sends webhook events as GET requests with the details in the query string, including the test event it sends when you save the webhook. The webhook is an `api.raw` endpoint that receives Node's `IncomingMessage`/`ServerResponse` and reads the query string itself. `method: ["GET", "POST"]` also lets you test it with a form-encoded POST from curl, which the typed `api()` could not parse.
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
verified in Elastic Email. Return { success, transactionId, messageId } from response.data and throw
APIError with the mapped code on failure (err.response.data.Error). Add GET /health and an `api.raw`
endpoint for GET|POST /webhook that checks ?token= against secret("ElasticEmailWebhookToken") with
crypto.timingSafeEqual, parses form-encoded bodies with URLSearchParams and logs the status field.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Encore.ts docs](https://encore.dev/docs/ts)
- [Encore.ts raw endpoints](https://encore.dev/docs/ts/primitives/raw-endpoints)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
