# Send Email from AWS Lambda - Elastic Email API

One Lambda function behind an HTTP API (API Gateway v2) that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API and receives its webhooks. Routes are `POST /send`, `ANY /webhook` and `GET /health`, packaged with AWS SAM and bundled by esbuild.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.4.0` · Node.js 20 (AWS SAM) · AWS Lambda

## Prerequisites

- Node.js 20+
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) and configured AWS credentials
- Docker (only for `sam local start-api`)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp env.example.json env.json   # local values for `sam local`
```

## Secrets

The API key is a CloudFormation parameter with `NoEcho: true` and lands in the function's environment variables. `sam deploy --guided` prompts for it and stores the value in `samconfig.toml`; do not commit that file if you keep the key in it. For production consider moving the key to AWS Secrets Manager or SSM Parameter Store and resolving it with `{{resolve:ssm-secure:...}}` in `template.yaml`.

`ElasticEmailWebhookSecret` is the `SigningSecret` (`whsec_...`) returned once when you create the webhook with `EnableSigning: true` and `DeliveryMethod: PostJson` (see [Webhooks](../README.md#webhooks)). Leave it empty on the first deploy, create the webhook, then run `sam deploy --parameter-overrides ElasticEmailWebhookSecret=whsec_...` (plus your other parameters). While it is empty, `/webhook` falls back to the `?token=` check (`ElasticEmailWebhookToken`) for unsigned webhooks.

## Deploy

```bash
sam build
sam deploy --guided
# Stack name, region, then the parameters ElasticEmailApiKey, ElasticEmailWebhookToken,
# ElasticEmailWebhookSecret (empty until you create a signed webhook), EmailFrom
```

The `ApiUrl` output is the base URL. Redeploy later with `sam build && sam deploy`.

Local run:

```bash
sam build
sam local start-api --env-vars env.json   # http://127.0.0.1:3000
```

## Test with curl

```bash
URL=https://<api-id>.execute-api.<region>.amazonaws.com   # or http://127.0.0.1:3000

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Lambda!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

That last request only works while `ELASTICEMAIL_WEBHOOK_SECRET` is empty. With a signing secret set, send a signed request as shown in [Webhooks](../README.md#webhooks).

Logs: `sam logs -n EmailFunction --stack-name <stack> --tail`.

## Notes on runtime quirks

- `POST /send` takes an optional `Idempotency-Key` request header: it is forwarded to Elastic Email (a new key is generated otherwise), so clients can retry safely with the same key (API Gateway HTTP APIs lowercase header names, so it is read as `event.headers["idempotency-key"]`).
- The handler receives an `APIGatewayProxyEventV2` and returns `{ statusCode, headers, body }`. Query parameters are in `event.queryStringParameters`, the method in `event.requestContext.http.method`.
- HTTP API base64-encodes request bodies it does not recognise as text. `rawBytes()` checks `event.isBase64Encoded` and returns the body bytes as received, which is what the webhook signature covers. The signed request target is `event.rawPath` plus `?` and `event.rawQueryString` (still URL-encoded), not the decoded `queryStringParameters`. This assumes the `$default` stage, which SAM's implicit HTTP API uses; with a named stage, `rawPath` includes the stage name.
- The `EmailsApi` instance is created lazily and cached in module scope so warm invocations reuse it.
- `ANY /webhook` accepts every method. Signed webhooks with JSON delivery send POST; unsigned ones send GET with the event in the query string.
- SAM's esbuild build (`Metadata.BuildMethod: esbuild`) bundles the SDK and axios into a single CommonJS file, so no `node_modules` is uploaded. `npm run build` does the same locally for inspection.

## AI assistant prompt

```
Write an AWS Lambda handler in TypeScript for an HTTP API (APIGatewayProxyEventV2) that sends email with
Elastic Email, deployed with AWS SAM (template.yaml, Runtime nodejs20.x, esbuild BuildMethod).
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x). Read the API key from
process.env.ELASTICEMAIL_API_KEY, populated from a NoEcho CloudFormation parameter; never hardcode keys.
Create `new Configuration({ apiKey })` and `new EmailsApi(configuration)`, cached in module scope.
Routes: GET /health returns { status: "ok" }; POST /send takes { to, subject, message } and calls
emailsApi.emailsTransactionalPost with Recipients.To = [to] and
Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }. The From address must be a sender
Forward an incoming Idempotency-Key header as the second argument of emailsTransactionalPost (a new UUID if absent).
verified in Elastic Email. Return { statusCode, headers, body } with body JSON { success, transactionId, messageId }
from response.data, or { error } with the API status on failure (err.response.data.Error).
ANY /webhook verifies the Elastic Email signature when process.env.ELASTICEMAIL_WEBHOOK_SECRET is set:
X-ElasticEmail-Signature holds comma-separated v1=<hex> entries, each the hex HMAC-SHA256 (node:crypto, key = the
secret) of `${X-ElasticEmail-Timestamp}\n${method}\n${rawPath}?${rawQueryString}\n${raw body}` (decode base64
bodies when isBase64Encoded); reject timestamps older than 300 s, compare with crypto.timingSafeEqual, answer 401 on
failure, then read the event from the JSON body (POST) or the query (GET). Without the secret it checks
queryStringParameters.token against process.env.ELASTICEMAIL_WEBHOOK_TOKEN. Log the status field.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [AWS SAM docs](https://docs.aws.amazon.com/serverless-application-model/)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
