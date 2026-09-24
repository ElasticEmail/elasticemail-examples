# Send Email from Azure Functions - Elastic Email API

Three HTTP-triggered Azure Functions on the Node.js v4 programming model (`app.http(...)` from `@azure/functions`) that send transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API and receive its webhooks: `GET /health`, `POST /send` and `GET|POST /webhook`. Written in TypeScript, run locally with Azure Functions Core Tools, and configured through app settings or Key Vault references in Azure.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20 (Azure Functions v4) · Azure Functions

## Prerequisites

- Node.js 20+ and an Azure subscription
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local): `npm install -g azure-functions-core-tools@4`
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`) to create the Function App
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp local.settings.json.example local.settings.json   # local values for `func start`
```

`local.settings.json` is the Functions equivalent of `.env`: its `Values` become `process.env` when you run locally. It is gitignored and listed in `.funcignore`, so it is never committed or uploaded.

Create the Function App once (a Flex Consumption plan on Linux):

```bash
az login
az group create --name elasticemail-rg --location westeurope
az storage account create --name <uniquestorage> --resource-group elasticemail-rg --sku Standard_LRS
az functionapp create --name <app-name> --resource-group elasticemail-rg \
  --storage-account <uniquestorage> --flexconsumption-location westeurope \
  --runtime node --runtime-version 20
```

## Secrets

In Azure, environment variables are app settings on the Function App:

```bash
az functionapp config appsettings set --name <app-name> --resource-group elasticemail-rg --settings \
  ELASTICEMAIL_API_KEY=your_api_key \
  ELASTICEMAIL_WEBHOOK_TOKEN=change_me \
  "EMAIL_FROM=Acme <hello@yourdomain.com>"
```

App settings are encrypted at rest. To keep the key in Key Vault instead, give the Function App a managed identity with read access to the vault and set the value to a Key Vault reference; the code does not change:

```bash
az functionapp config appsettings set --name <app-name> --resource-group elasticemail-rg --settings \
  "ELASTICEMAIL_API_KEY=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/elasticemail-api-key/)"
```

## Deploy

```bash
npm start                                          # build + func start, http://localhost:7071
npm run build && func azure functionapp publish <app-name>
```

Publish prints the three function URLs on the app's `azurewebsites.net` hostname. `npm run deploy -- <app-name>` does the same build and publish.

## Test with curl

```bash
URL=http://localhost:7071   # or the https://...azurewebsites.net host publish printed

curl $URL/health

# Deployed, /send needs the function key: add -H "x-functions-key: <key>" (see Notes)
curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Azure Functions!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

Logs: `func azure functionapp logstream <app-name>`, or Application Insights in the portal.

## Notes on runtime quirks

- Full Node.js, so the SDK uses its default axios adapter and `node:crypto` is available for the constant-time token compare.
- The v4 programming model has no `function.json` files. Functions register themselves with `app.http(...)` when their file loads, and `"main": "dist/src/functions/*.js"` in `package.json` tells the host which compiled files to load. If `func start` finds no functions, run `npm run build` first.
- HTTP routes get an `/api` prefix by default. `host.json` sets `"routePrefix": ""` so the paths match the other platforms; remove it if you prefer `/api/send`.
- `HttpRequest` is Fetch-style: `req.query` is a `URLSearchParams`, and the body is read with `await req.json()` or `await req.formData()`. Handlers return `{ status, jsonBody }`.
- `send` uses `authLevel: "function"`, so once deployed anyone calling `/send` must present a function key, as `?code=<key>` or an `x-functions-key` header. Get it with `az functionapp function keys list --name <app-name> --resource-group <rg> --function-name send`. `func start` does not check keys, so local testing needs none. `health` and `webhook` stay `anonymous`: Elastic Email cannot send a function key, and the save-time test event must get a 2xx or the webhook is not saved, so the `?token=` check protects the webhook.
- `context.log` writes to Application Insights with the invocation ID attached; plain `console.log` also works but loses that correlation.

## AI assistant prompt

```
Write Azure Functions in TypeScript on the Node.js v4 programming model (@azure/functions ^4, app.http, no
function.json) that send email with Elastic Email. Use the npm package @elasticemail/elasticemail-client-ts-axios
(version 4.x). Read the API key from process.env.ELASTICEMAIL_API_KEY, set in local.settings.json locally and as
an app setting (or Key Vault reference) in Azure; never hardcode keys. Create `new Configuration({ apiKey })`
and `new EmailsApi(configuration)`, cached in module scope. Set "routePrefix": "" in host.json.
Functions: GET /health returns { jsonBody: { status: "ok" } }; POST /send takes { to, subject, message } from
await req.json() and calls emailsApi.emailsTransactionalPost with Recipients.To = [to] and
Content = { From, Subject, Body: [{ ContentType: "HTML", Content }, { ContentType: "PlainText", Content }] }.
The From address must be a sender verified in Elastic Email. Return { success, transactionId, messageId } from
response.data, and { status, jsonBody: { error } } with the API status on failure (err.response.data.Error).
GET|POST /webhook (authLevel "anonymous") checks req.query.get("token") against
process.env.ELASTICEMAIL_WEBHOOK_TOKEN with crypto.timingSafeEqual, reads form bodies with req.formData(),
and logs the status field with context.log.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Azure Functions Node.js developer guide (v4 model)](https://learn.microsoft.com/azure/azure-functions/functions-reference-node)
- [Use Key Vault references](https://learn.microsoft.com/azure/app-service/app-service-key-vault-references)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
