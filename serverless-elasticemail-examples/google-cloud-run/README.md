# Send Email from Google Cloud Run - Elastic Email API

A containerised Hono server on Node.js 20 that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API and receives its webhooks, deployed to Google Cloud Run. `gcloud run deploy --source .` builds the included `Dockerfile` with Cloud Build, and the API key comes from Secret Manager instead of a plain environment variable.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20 (container) · Google Cloud Run

## Prerequisites

- Node.js 20+ and a Google Cloud project with billing enabled
- The [gcloud CLI](https://cloud.google.com/sdk/docs/install)
- Docker (optional, only to run the container locally)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp .env.example .env
gcloud auth login
gcloud config set project <your-project-id>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

## Secrets

Store the API key and the webhook token in Secret Manager:

```bash
printf '%s' 'your_api_key' | gcloud secrets create elasticemail-api-key --data-file=-
printf '%s' 'change_me'    | gcloud secrets create elasticemail-webhook-token --data-file=-
```

The service's runtime service account needs read access. By default that is the Compute Engine default service account:

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
for s in elasticemail-api-key elasticemail-webhook-token; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done
```

`--set-secrets` on deploy maps each secret to an environment variable, so the code reads `process.env.ELASTICEMAIL_API_KEY` like any other Node app. `EMAIL_FROM` is not secret and goes in `--set-env-vars`.

## Deploy

```bash
npm run dev    # local, http://localhost:8080

gcloud run deploy elasticemail-example \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-secrets ELASTICEMAIL_API_KEY=elasticemail-api-key:latest,ELASTICEMAIL_WEBHOOK_TOKEN=elasticemail-webhook-token:latest \
  --set-env-vars "EMAIL_FROM=Acme <hello@yourdomain.com>"
```

The command prints the service URL (`https://elasticemail-example-<hash>.<region>.run.app`). Redeploy with the same command; the secrets and env vars stick to the service, so later deploys only need `--source .` and `--region`.

To run the container locally the way Cloud Run does:

```bash
docker build -t elasticemail-example .
docker run --rm -p 8080:8080 --env-file .env elasticemail-example
```

## Test with curl

```bash
URL=http://localhost:8080   # or the https://...run.app URL

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Cloud Run!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

Logs: `gcloud run services logs read elasticemail-example --region europe-west1`, or Logs Explorer in the console.

## Notes on runtime quirks

- Full Node.js in a container, so the SDK uses its default axios adapter and `node:crypto` is available for the constant-time token compare.
- Cloud Run sets `PORT` (8080 unless you change it). The server binds `0.0.0.0:$PORT`; binding to `localhost` makes the revision fail its startup check.
- Use `/health`, not `/healthz`. Cloud Run's frontend reserves some paths ending in `z`, and requests to them never reach the container.
- `--allow-unauthenticated` is required for the webhook: Elastic Email calls it without Google credentials, and the save-time test event must get a 2xx or the webhook is not saved. The `?token=` check is what protects it. It also leaves `/send` open to anyone with the URL, so add your own auth before using this in production, or deploy the send path as a separate service without `--allow-unauthenticated`.
- A secret referenced as `:latest` is resolved when an instance starts. After rotating the key, deploy a new revision (or pin a version number) so running instances pick it up.
- The process exits at startup if `ELASTICEMAIL_API_KEY` is missing, so a deploy without `--set-secrets` fails its health check instead of serving errors.
- `.gcloudignore` keeps `node_modules`, `dist` and `.env` out of the upload; the `Dockerfile` installs and builds inside Cloud Build.

## AI assistant prompt

```
Write a Hono server for Node.js 20 in TypeScript, packaged with a Dockerfile and deployed to Google Cloud Run
with `gcloud run deploy --source .`, that sends email with Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x). Read the API key from
process.env.ELASTICEMAIL_API_KEY, mapped from Secret Manager with --set-secrets; exit with a clear message
if it is missing, and never hardcode keys. Create `new Configuration({ apiKey })` and `new EmailsApi(configuration)`.
Routes: GET /health returns { status: "ok" }; POST /send takes { to, subject, message } and calls
emailsApi.emailsTransactionalPost with Recipients.To = [to] and Content = { From, Subject,
Body: [{ ContentType: "HTML", Content }, { ContentType: "PlainText", Content }] }. The From address must be
a sender verified in Elastic Email. Return { success, transactionId, messageId } from response.data, and
{ error } with the API status on failure (err.response.data.Error). GET|POST /webhook checks ?token= against
process.env.ELASTICEMAIL_WEBHOOK_TOKEN with crypto.timingSafeEqual and logs the status field.
Listen on process.env.PORT (default 8080) bound to 0.0.0.0.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Cloud Run: deploy from source](https://cloud.google.com/run/docs/deploying-source-code)
- [Cloud Run: configure secrets](https://cloud.google.com/run/docs/configuring/services/secrets)
- [Hono](https://hono.dev)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
