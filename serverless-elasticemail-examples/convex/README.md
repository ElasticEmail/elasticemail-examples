# Send Email from Convex - Elastic Email API

A Convex backend that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API. `convex/http.ts` exposes `GET /health`, `POST /send` and `GET|POST /webhook` as HTTP actions, and the SDK call runs in an internal `"use node"` action (`convex/email.ts`) that the HTTP action invokes with `ctx.runAction`. Environment variables are set on the deployment with `npx convex env set`.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.3.0` · Convex (Node.js actions) · Convex

## Prerequisites

- Node.js 20+ and a Convex account (or a local deployment, see below)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

The Convex CLI ships in the `convex` npm package, so there is nothing to install globally.

## Setup

```bash
npm install
npx convex dev    # log in, create or pick a project, then watch and push convex/ on every save
```

The first run writes `CONVEX_DEPLOYMENT` to `.env.local` and regenerates `convex/_generated/`. Keep `npx convex dev` running in one terminal while you work.

## Secrets

```bash
npx convex env set ELASTICEMAIL_API_KEY your_api_key
npx convex env set ELASTICEMAIL_WEBHOOK_TOKEN change_me
npx convex env set EMAIL_FROM "Acme <hello@yourdomain.com>"
npx convex env set ELASTICEMAIL_WEBHOOK_SECRET whsec_...   # after creating a signed webhook
```

`ELASTICEMAIL_WEBHOOK_SECRET` is the `SigningSecret` (`whsec_...`) returned once when you create the webhook with `EnableSigning: true` and `DeliveryMethod: PostJson` (see [Webhooks](../README.md#webhooks)). Set it after creating the webhook; while it is empty, `/webhook` falls back to the `?token=` check (`ELASTICEMAIL_WEBHOOK_TOKEN`) for unsigned webhooks.

Or copy `.env.example` to `.env`, fill it in and run `npx convex env set --from-file .env`. Each deployment (your dev deployment, production, previews) has its own variables; add `--prod` to set them on production. Functions read them from `process.env`, in both the Convex runtime and the Node.js runtime.

## Deploy

```bash
npx convex dev      # dev deployment, pushes on save
npx convex deploy   # production
```

HTTP actions are served from the deployment's `.convex.site` domain (not `.convex.cloud`), for example `https://happy-animal-123.convex.site/send`. The dashboard shows it under Settings > URL and Deploy Key.

## Test with curl

```bash
URL=https://<deployment>.convex.site   # local deployment: http://127.0.0.1:3211

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Convex!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

That last request only works while `ELASTICEMAIL_WEBHOOK_SECRET` is empty. With a signing secret set, send a signed request as shown in [Webhooks](../README.md#webhooks).

Logs stream in the `npx convex dev` terminal, or run `npx convex logs`.

## Notes on runtime quirks

- HTTP actions run in Convex's default JavaScript runtime, which has `fetch` but no `node:http` or `node:crypto`. The SDK call therefore lives in `convex/email.ts`, which starts with `"use node"` and runs in Convex's Node.js runtime, where the SDK's default axios adapter works. A `"use node"` file may export only actions.
- `email.send` is an `internalAction`: other Convex functions can call it (an HTTP action, a mutation, a cron job), but clients cannot. To let your React or mobile app trigger an email, write a public action or mutation that checks `ctx.auth.getUserIdentity()` and decides the recipient on the server, then calls the internal action.
- The internal action returns `{ ok: false, status, error }` instead of throwing, so the HTTP action can pass Elastic Email's status code and message through unchanged.
- Sending from a mutation: mutations cannot call external APIs, so schedule the action with `ctx.scheduler.runAfter(0, internal.email.send, { to, subject, message })`. The email then goes out only if the mutation commits.
- `node:crypto` is not available in the default runtime, so the webhook signature is checked with WebCrypto (`crypto.subtle`) and compared, like the token, with a hand-written constant-time loop. The handler reads `await request.text()` before parsing JSON and signs `pathname + search` of `new URL(request.url)`, which keeps the percent-encoding.
- HTTP actions are public, which the webhook needs: Elastic Email calls it without credentials. The signature check (or, for unsigned webhooks, the `?token=` check) protects it. `/send` is open too, so add your own auth before using it in production.
- `convex/_generated/` is generated by `npx convex dev` and committed, as Convex recommends, so `npm run typecheck` works without a deployment.
- To try it without an account, `npx convex dev` offers to start a local deployment (a Convex backend on your machine, HTTP actions on `http://127.0.0.1:3211`). Local Node actions need Node.js 20, 22 or 24 on your `PATH`.

## AI assistant prompt

```
Write a Convex backend in TypeScript that sends email with Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x). Read the API key from
process.env.ELASTICEMAIL_API_KEY, set with `npx convex env set`; never hardcode keys.
In convex/email.ts, start the file with "use node" and export an internalAction `send` with args
{ to: v.string(), subject: v.string(), message: v.string() }. It creates `new Configuration({ apiKey })`
and `new EmailsApi(configuration)` and calls emailsApi.emailsTransactionalPost with Recipients.To = [to] and
Content = { From, Subject, Body: [{ ContentType: "HTML", Content }, { ContentType: "PlainText", Content }] }.
The From address must be a sender verified in Elastic Email. Return { ok: true, transactionId, messageId }
from response.data, or { ok: false, status, error } from err.response on failure, with a `returns` validator.
In convex/http.ts use httpRouter and httpAction: GET /health returns { status: "ok" }; POST /send validates
{ to, subject, message }, calls ctx.runAction(internal.email.send, ...) and returns
{ success, transactionId, messageId } or { error } with the API status; POST and GET /webhook verifies the Elastic Email signature when ELASTICEMAIL_WEBHOOK_SECRET is set:
X-ElasticEmail-Signature holds comma-separated v1=<hex> entries, each the hex HMAC-SHA256 (WebCrypto crypto.subtle, no node:crypto in HTTP actions, key = the
secret) of `${X-ElasticEmail-Timestamp}\n${method}\n${pathname + search of new URL(request.url)}\n${raw body}`, with the raw body read before
parsing; reject timestamps older than 300 s, compare in constant time, answer 401 on failure, then read the event
from the JSON body (POST) or the query (GET). Without the secret it checks ?token=
against process.env.ELASTICEMAIL_WEBHOOK_TOKEN. Log the status field.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Convex HTTP actions](https://docs.convex.dev/functions/http-actions)
- [Convex actions and the Node.js runtime](https://docs.convex.dev/functions/actions)
- [Convex environment variables](https://docs.convex.dev/production/environment-variables)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
