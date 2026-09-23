# Send Email from Deno Deploy - Elastic Email API

A single-file `Deno.serve` app that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API and handles its webhooks, with `/health`, `/send` and `/webhook`, deployed with `deployctl`.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Deno 2 · Deno Deploy

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
```

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

## Notes on runtime quirks

- axios' default Node adapter does not work under Deno's npm compatibility, so the code passes `axios.create({ adapter: "fetch" })` as the third argument of `new EmailsApi(configuration, basePath, axios)`.
- Dependencies are `npm:` specifiers pinned in `main.ts`; there is no `package.json`. `"nodeModulesDir": "none"` keeps the folder free of `node_modules`.
- `deno run -A` grants all permissions. For production narrow this to `--allow-net --allow-env`.
- Deno Deploy runs the module once per isolate, so the `ELASTICEMAIL_API_KEY` check at the top fails fast on the first request if the variable is missing.

## AI assistant prompt

```
Write a Deno Deploy app (Deno.serve, single main.ts) in TypeScript that sends email with Elastic Email.
Import { Configuration, EmailsApi } from "npm:@elasticemail/elasticemail-client-ts-axios@4.2.0" and
axios from "npm:axios@1.18.1". Read the key with Deno.env.get("ELASTICEMAIL_API_KEY") and fail fast if missing;
never hardcode keys. Create `new Configuration({ apiKey })` and
`new EmailsApi(configuration, undefined, axios.create({ adapter: "fetch" }))` because axios' Node adapter
does not work under Deno. Route on new URL(req.url).pathname: GET /health returns { status: "ok" };
POST /send takes { to, subject, message } and calls emailsApi.emailsTransactionalPost with
Recipients.To = [to] and Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }.
The From address must be a sender verified in Elastic Email. Return { success, transactionId, messageId }
from response.data and { error } with the API status on failure (err.response.data.Error).
GET|POST /webhook checks ?token= against ELASTICEMAIL_WEBHOOK_TOKEN with a constant-time compare and logs
the status field. Add deno.json tasks: dev (deno run -A --env main.ts) and deploy (deployctl deploy).
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Deno Deploy docs](https://docs.deno.com/deploy/)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
