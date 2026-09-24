# Send your first email from a serverless function

Five minutes from a clean clone to a delivered email, on the platform of your choice. Every folder
here is a standalone project with the same three endpoints:

- `GET /health` -> `{ status: "ok" }`
- `POST /send` with `{ to, subject, message }` -> `{ success, transactionId, messageId }`
- `GET|POST /webhook?token=...` -> Elastic Email event handler

## Prerequisites

- Node.js 20+ (or Deno, where noted)
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain
- The CLI for your platform

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

Creating and managing keys is covered in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. The code, on every platform

```typescript
import axios from "axios";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });

// The third argument is only needed on runtimes without Node's http module.
const emailsApi = new EmailsApi(config, undefined, axios.create({ adapter: "fetch" }));

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: process.env.EMAIL_FROM!,
    Subject: subject,
    Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
  },
});
// data.TransactionID, data.MessageID
```

**The fetch adapter is the one thing that trips everyone up.** Cloudflare Workers, Vercel Edge,
Netlify Edge, Deno and Supabase have no `node:http`, which axios reaches for by default. Passing a
fetch-based axios instance as the third constructor argument is what makes the SDK work there. Keep
your top-level `axios` dependency on the same range the SDK uses (`~1.18.0`) so npm dedupes it.

On plain Node runtimes (AWS Lambda, Railway, Encore, Vercel's Node functions, Firebase, Azure Functions,
Cloud Run and Convex Node actions) the third argument is unnecessary.

## 4. Pick a platform

### Cloudflare Workers

```bash
cd cloudflare-workers
npm install
cp .dev.vars.example .dev.vars
wrangler login
wrangler secret put ELASTICEMAIL_API_KEY
wrangler secret put ELASTICEMAIL_WEBHOOK_TOKEN

npm run dev      # http://localhost:8787
npm run deploy
```

Environment variables are not globals on Workers - they arrive as the second argument of
`fetch(request, env)`, so the `EmailsApi` is built per request. `nodejs_compat` is enabled in
`wrangler.toml` so axios' Node imports resolve at bundle time.

### Vercel Functions

```bash
cd vercel-functions
npm install
vercel login && vercel link
vercel env add ELASTICEMAIL_API_KEY
vercel env add ELASTICEMAIL_WEBHOOK_TOKEN
vercel env add EMAIL_FROM

npm run dev      # http://localhost:3000
npm run deploy
```

`api/send.ts` runs on Node, `api/send-edge.ts` is the same thing on the Edge runtime. Files starting
with `_` are not deployed as functions, which is where the shared code lives.

### Supabase Edge Functions

```bash
cd supabase-edge-functions
cp .env.example .env
supabase login && supabase link --project-ref <your-project-ref>
supabase secrets set --env-file .env

supabase functions serve --env-file .env --no-verify-jwt   # local
supabase functions deploy send
```

No `npm install` - the functions import `npm:` specifiers directly and Deno fetches them. Set
`verify_jwt = false` for the webhook function; Elastic Email posts no JWT. There is also an
`auth-hook` function that delivers Supabase Auth's sign-up and magic link emails through Elastic
Email.

### AWS Lambda (SAM)

```bash
cd aws-lambda
npm install
cp env.example.json env.json

sam build
sam local start-api --env-vars env.json   # http://127.0.0.1:3000
sam deploy --guided                       # prompts for the API key parameter
```

The key is a CloudFormation parameter with `NoEcho: true`. For production, move it to Secrets Manager
or SSM and resolve it with `{{resolve:ssm-secure:...}}` in `template.yaml`.

### Deno Deploy

```bash
cd deno-deploy
cp .env.example .env
deno task check

deno task dev      # http://localhost:8000
deno task deploy
```

### Netlify Functions

```bash
cd netlify-functions
npm install
netlify login && netlify init
netlify env:import .env

npm run dev      # http://localhost:8888
npm run deploy
```

### Railway

```bash
cd railway
npm install
railway login && railway init
railway variables set ELASTICEMAIL_API_KEY=your_api_key

npm run dev      # http://localhost:3000
railway up
railway domain   # generate a public URL
```

A long-running Hono server rather than a function. Railway sets `PORT`; the server binds
`0.0.0.0:$PORT`.

### Encore.ts

```bash
cd encore-ts
npm install
encore auth login && encore app init
encore secret set --type dev,local,pr,prod ElasticEmailApiKey
encore secret set --type dev,local,pr,prod ElasticEmailWebhookToken

encore run                 # http://localhost:4000, dashboard at :9400
git push encore            # deploy
```

Secrets are read in code with `secret("ElasticEmailApiKey")()`, not from `process.env`.

### Firebase Cloud Functions

```bash
cd firebase-functions
npm install
cp .env.example .env
cp .secret.local.example .secret.local
firebase login && firebase use --add
firebase functions:secrets:set ELASTICEMAIL_API_KEY
firebase functions:secrets:set ELASTICEMAIL_WEBHOOK_TOKEN

npm run serve    # http://127.0.0.1:5001/demo-elasticemail/us-central1/api
npm run deploy
```

Secrets are declared with `defineSecret` and read with `.value()` at request time. The folder also has a
callable function, `sendEmailToMe`, for Flutter and other mobile apps, which must never embed the API key.

### Azure Functions

```bash
cd azure-functions
npm install
cp local.settings.json.example local.settings.json
az login   # then create the Function App, see the README

npm start                                        # http://localhost:7071
az functionapp config appsettings set --name <app-name> --resource-group <rg> \
  --settings ELASTICEMAIL_API_KEY=your_api_key ELASTICEMAIL_WEBHOOK_TOKEN=change_me
npm run build && func azure functionapp publish <app-name>
```

Node.js v4 programming model: functions register with `app.http(...)`, no `function.json`. `host.json`
clears the default `/api` route prefix so the paths match the other platforms. Once deployed, `/send`
requires the function key (`x-functions-key` header); the webhook stays anonymous behind its `?token=`.

### Google Cloud Run

```bash
cd google-cloud-run
npm install
cp .env.example .env
printf '%s' 'your_api_key' | gcloud secrets create elasticemail-api-key --data-file=-
printf '%s' 'change_me'    | gcloud secrets create elasticemail-webhook-token --data-file=-

npm run dev      # http://localhost:8080
gcloud run deploy elasticemail-example --source . --region europe-west1 --allow-unauthenticated \
  --set-secrets ELASTICEMAIL_API_KEY=elasticemail-api-key:latest,ELASTICEMAIL_WEBHOOK_TOKEN=elasticemail-webhook-token:latest
```

A Hono server in a container, built from the `Dockerfile` by Cloud Build. The runtime service account
needs `roles/secretmanager.secretAccessor` on both secrets (see the README).

### Convex

```bash
cd convex
npm install
npx convex dev   # log in (or run locally), pushes convex/ on save
npx convex env set ELASTICEMAIL_API_KEY your_api_key
npx convex env set ELASTICEMAIL_WEBHOOK_TOKEN change_me
npx convex env set EMAIL_FROM "Acme <hello@yourdomain.com>"

npx convex deploy   # HTTP actions at https://<deployment>.convex.site
```

HTTP actions run in Convex's own runtime, so the SDK call lives in a `"use node"` internal action that
`convex/http.ts` invokes with `ctx.runAction`.

## 5. Test it

```bash
URL=http://localhost:8787     # whatever your platform printed

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from the edge!"}'

# Simulate an event the way Elastic Email sends it: form-encoded
curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

## 6. Register the webhook

Once deployed you have a public HTTPS URL, which is all a webhook needs:

```typescript
await new WebhookApi(config).webhookPost({
  Name: "serverless-example",
  URL: `https://<your-deployment>/webhook?token=${process.env.ELASTICEMAIL_WEBHOOK_TOKEN}`,
  NotificationForSent: true,
  NotificationForOpened: true,
  NotificationForClicked: true,
  NotificationForError: true,
});
```

When you save a webhook, Elastic Email sends one test event to the URL and saves the webhook only
if it gets a 2xx response, so deploy before registering. The test event carries sample values
(`to=test@test.com`, `messageid=abc1234`). The handlers accept it like any other event; in your own
app, skip it before it reaches your data.

## Next steps

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Handle events properly at scale | [Webhooks](../docs/webhooks.md) |
| Fix a runtime-specific failure | [Troubleshooting](../docs/troubleshooting.md) |
| Platform notes, quirks and an AI assistant prompt | the README in each folder |
