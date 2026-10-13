# Send Email from Deno Deploy - Elastic Email API

A single-file `Deno.serve` app that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API and handles its webhooks, with `/health`, `/send` and `/webhook`, deployed with `deployctl`.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.4.0` · Deno 2 · Deno Deploy

## Prerequisites

- [Deno](https://deno.com) 2.x
- `deno install -gArf jsr:@deno/deployctl`
- A [Deno Deploy](https://dash.deno.com) account and project
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
cp .env.example .env
deno task check     # type-checks main.ts and downloads the npm packages
```

Replace `elasticemail-example` in the `deploy` task of `deno.json` with your project name.

## Secrets

Local runs read `.env` through the `--env` flag. For Deno Deploy, open the project > Settings > Environment Variables and add:

```
ELASTICEMAIL_API_KEY
EMAIL_FROM
ELASTICEMAIL_WEBHOOK_TOKEN
ELASTICEMAIL_WEBHOOK_SECRET
```

`ELASTICEMAIL_WEBHOOK_SECRET` is the `SigningSecret` (`whsec_...`) returned once when you create the webhook with `EnableSigning: true` and `DeliveryMethod: PostJson` (see [Webhooks](../README.md#webhooks)). Set it after creating the webhook; while it is empty, `/webhook` falls back to the `?token=` check (`ELASTICEMAIL_WEBHOOK_TOKEN`) for unsigned webhooks.

Or from the CLI: `deployctl deploy --env-file=.env ...` (variables are stored on the deployment).

## Deploy

```bash
deno task dev      # http://localhost:8000
deno task deploy   # prints https://<project>.deno.dev
```

## Test with curl

```bash
URL=http://localhost:8000   # or https://<project>.deno.dev

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Deno!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

That last request only works while `ELASTICEMAIL_WEBHOOK_SECRET` is empty. With a signing secret set, send a signed request as shown in [Webhooks](../README.md#webhooks).

## Notes on runtime quirks

- `POST /send` takes an optional `Idempotency-Key` request header: it is forwarded to Elastic Email (a new key is generated otherwise), so clients can retry safely with the same key; the fallback key comes from the global `crypto.randomUUID()`.
- Deno skips npm versions published less than 24 hours ago (its minimum dependency age, on by default). Right after an SDK release, `@4.4.0` may not resolve yet: wait a day, or pass `--min-dep-age 0` once if you need it sooner.
- axios' default Node adapter does not work under Deno's npm compatibility, so the code passes `axios.create({ adapter: "fetch" })` as the third argument of `new EmailsApi(configuration, basePath, axios)`.
- Dependencies are `npm:` specifiers pinned in `main.ts`; there is no `package.json`. `"nodeModulesDir": "none"` keeps the folder free of `node_modules`.
- The webhook signature is checked with WebCrypto (`crypto.subtle`), built into Deno. The handler reads `await req.text()` before parsing JSON and signs `pathname + search` of `new URL(req.url)`, which keeps the percent-encoding.
- `deno run -A` grants all permissions. For production narrow this to `--allow-net --allow-env`.
- Deno Deploy runs the module once per isolate, so the `ELASTICEMAIL_API_KEY` check at the top fails fast on the first request if the variable is missing.

## AI assistant prompt

```
Write a Deno Deploy app (Deno.serve, single main.ts) in TypeScript that sends email with Elastic Email.
Import { Configuration, EmailsApi } from "npm:@elasticemail/elasticemail-client-ts-axios@4.4.0" and
axios from "npm:axios@1.18.1". Read the key with Deno.env.get("ELASTICEMAIL_API_KEY") and fail fast if missing;
never hardcode keys. Create `new Configuration({ apiKey })` and
`new EmailsApi(configuration, undefined, axios.create({ adapter: "fetch" }))` because axios' Node adapter
does not work under Deno. Route on new URL(req.url).pathname: GET /health returns { status: "ok" };
POST /send takes { to, subject, message } and calls emailsApi.emailsTransactionalPost with
Recipients.To = [to] and Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }.
Forward an incoming Idempotency-Key header as the second argument of emailsTransactionalPost (a new UUID if absent).
The From address must be a sender verified in Elastic Email. Return { success, transactionId, messageId }
from response.data and { error } with the API status on failure (err.response.data.Error).
POST|GET /webhook verifies the Elastic Email signature when ELASTICEMAIL_WEBHOOK_SECRET is set:
X-ElasticEmail-Signature holds comma-separated v1=<hex> entries, each the hex HMAC-SHA256 (WebCrypto crypto.subtle, key = the
secret) of `${X-ElasticEmail-Timestamp}\n${method}\n${pathname + search of new URL(req.url)}\n${raw body}`, with the raw body read before
parsing; reject timestamps older than 300 s, compare in constant time, answer 401 on failure, then read the event
from the JSON body (POST) or the query (GET). Without the secret it checks ?token= against
ELASTICEMAIL_WEBHOOK_TOKEN. Log the status field. Add deno.json tasks: dev (deno run -A --env main.ts) and deploy (deployctl deploy).
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Deno Deploy docs](https://docs.deno.com/deploy/)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
