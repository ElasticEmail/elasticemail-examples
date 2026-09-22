# Send Email from Railway - Elastic Email API

A small Hono server on Node.js that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API, with `/health`, `/send` and `/webhook`, deployed to Railway. Railway runs long-lived containers rather than functions, so this is the same code you would run on any VPS.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

## Prerequisites

- Node.js 20+ and a Railway account
- `npm install -g @railway/cli`
- An Elastic Email account with a verified sender domain
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)

## Setup

```bash
npm install
cp .env.example .env
railway login
railway init      # create a project, or `railway link` to an existing one
```

## Secrets

```bash
railway variables set ELASTICEMAIL_API_KEY=your_api_key
railway variables set ELASTICEMAIL_WEBHOOK_TOKEN=change_me
railway variables set EMAIL_FROM="Acme <hello@yourdomain.com>"
```

Railway sets `PORT` itself; the server binds to `0.0.0.0:$PORT`.

## Deploy

```bash
npm run dev       # local, http://localhost:3000
railway up        # build and deploy from the current directory
railway domain    # generate a public URL
```

`railway.json` tells Nixpacks to run `npm install && npm run build` and start with `npm start`. A `Dockerfile` is included if you prefer that path; Railway picks it up automatically when present, or set `"builder": "DOCKERFILE"`.

## Test with curl

```bash
URL=http://localhost:3000   # or https://<service>.up.railway.app

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Railway!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

Logs: `railway logs`.

## Notes on runtime quirks

- Full Node.js, so the SDK works with its default axios adapter and `node:crypto` is available for the constant-time token compare.
- The process exits at startup if `ELASTICEMAIL_API_KEY` is missing. Combined with `restartPolicyType: ON_FAILURE` this makes a misconfigured deploy visible immediately in the Railway dashboard.
- `healthcheckPath: /health` in `railway.json` makes Railway wait for a 200 before routing traffic to a new deploy.
- The compiled output in `dist/` uses ESM (`"type": "module"` + `NodeNext`), so `node dist/index.js` runs without a loader.

## AI assistant prompt

```
Write a Hono server for Node.js in TypeScript, deployable to Railway, that sends email with Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x). Read the API key from
process.env.ELASTICEMAIL_API_KEY set with `railway variables set`, exit with a clear message if it is
missing, and never hardcode keys. Create `new Configuration({ apiKey })` and `new EmailsApi(configuration)`.
Routes: GET /health returns { status: "ok" }; POST /send takes { to, subject, message } and calls
emailsApi.emailsTransactionalPost with Recipients.To = [to] and
Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }. The From address must be a sender
verified in Elastic Email. Return { success, transactionId, messageId } from response.data, and { error }
with the API status on failure (err.response.data.Error). GET|POST /webhook checks ?token= against
process.env.ELASTICEMAIL_WEBHOOK_TOKEN with crypto.timingSafeEqual and logs the status field.
Listen on process.env.PORT bound to 0.0.0.0 and add railway.json with build/start commands and
healthcheckPath "/health".
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Railway docs](https://docs.railway.com)
- [Hono](https://hono.dev)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
