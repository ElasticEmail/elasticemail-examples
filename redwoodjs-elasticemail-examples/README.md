# RedwoodJS Email API Examples - Elastic Email

Send transactional and bulk email from RedwoodJS 8 with the [Elastic Email](https://elasticemail.com/email-api) email API. The API side is a set of serverless functions, the web side is React pages that call them with `fetch` - no GraphQL or Prisma involved. TypeScript and JavaScript variants are included.

> **First time here?** The [RedwoodJS quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Node.js 20+ and Yarn (Redwood's CLI expects Yarn; `corepack enable` gives you Yarn 4)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/redwoodjs-elasticemail-examples

cp .env.example typescript/.env   # or javascript/.env
cd typescript                     # or javascript
yarn install
```

Edit `.env` and set at least `ELASTICEMAIL_API_KEY` and `EMAIL_FROM`. The other variables are listed in `.env.example` with a comment each. Redwood loads `.env` from the project root for both sides.

## RedwoodJS Application

```bash
yarn rw dev
```

Open http://localhost:8910. Every example has a page with a form and a result box. In development the web side proxies `/.redwood/functions/*` to the API server on port 8911, so the same URLs work from curl.

Functions receive an API Gateway style `event`. JSON bodies are parsed from `event.body`; webhook and inbound notifications arrive form-encoded and are parsed with `URLSearchParams` (see `api/src/lib/elasticemail.ts`).

Examples:

- Sending: basic send, attachments, CID (inline) attachments, templates with merge fields, scheduled send, prevent Gmail threading
- Events: webhook handler, inbound email handler
- Subscription: double opt-in with an HMAC-signed confirmation link (plus a Clicked-event based variant)
- Management: contacts on a list, domains and DNS verification state, account statistics

Test a function with curl:

```bash
curl -X POST http://localhost:8910/.redwood/functions/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from RedwoodJS"}'
```

Webhook and inbound handlers need a public URL. Run `ngrok http 8910`, set `PUBLIC_URL` to the HTTPS URL and use `PUBLIC_URL/.redwood/functions/webhook?token=<ELASTICEMAIL_WEBHOOK_TOKEN>` (or `/.redwood/functions/inbound?token=...`) when creating the webhook or inbound route in Elastic Email. Elastic Email does not sign these requests; the token in the query string is what the handlers verify.

Production build: `yarn rw build && yarn rw serve`. Type check: `yarn rw type-check`.

## API Endpoints

| Method | Path | Body / query | Elastic Email call |
|---|---|---|---|
| POST | `/.redwood/functions/send` | `{ to, subject, message }` | `emailsTransactionalPost` |
| POST | `/.redwood/functions/sendBatch` | `{ to }` | `emailsPost` with per-recipient `Fields` |
| POST | `/.redwood/functions/sendAttachment` | `{ to }` | `emailsTransactionalPost` with `Attachments` |
| POST | `/.redwood/functions/sendCid` | `{ to }` | `emailsTransactionalPost`, `<img src="cid:logo.png">` |
| POST | `/.redwood/functions/sendTemplate` | `{ to, firstName?, company? }` | `templatesByNameGet` / `templatesPost`, then send with `TemplateName` + `Merge` |
| POST | `/.redwood/functions/sendScheduled` | `{ to, delayMinutes? }` | `emailsTransactionalPost` with `Options.TimeOffset` |
| POST | `/.redwood/functions/sendPreventThreading` | `{ to, count? }` | 3 sends with `Headers["X-Entity-Ref-ID"]` |
| GET | `/.redwood/functions/contacts` | | `listsByListnameContactsGet` |
| POST | `/.redwood/functions/contacts` | `{ email, firstName?, lastName? }` | `listsPost` (ignore exists), `contactsPost(..., [listName])` |
| GET | `/.redwood/functions/domains` | | `domainsGet` |
| POST | `/.redwood/functions/domains` | `{ domain? }` | `domainsPost`, `domainsByDomainGet` |
| GET | `/.redwood/functions/statistics` | `?days=30` | `statisticsGet(from, to)` |
| GET, POST | `/.redwood/functions/webhook` | `?token=...` + event params | token check, log per `status` |
| POST | `/.redwood/functions/inbound` | `?token=...` + form fields | token check, forward to `CONTACT_EMAIL` |
| POST | `/.redwood/functions/doubleOptinSubscribe` | `{ email, name? }` | `contactsPost` (Transactional), send confirm link |
| GET | `/.redwood/functions/doubleOptinConfirm` | `?email=&token=` | HMAC check, `listsByNameContactsPost` |
| GET, POST | `/.redwood/functions/doubleOptinWebhook` | `?token=...` + event params | on `Clicked` of the confirm URL, `listsByNameContactsPost` |

Success responses for sends are `{ success: true, transactionId, messageId }`. Errors are `{ error }` with the status returned by the API.

## Quick Usage

```typescript
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: ["you@yourdomain.com"] },
  Content: {
    From: "Acme <hello@yourdomain.com>",
    Subject: "Hello from Elastic Email",
    Body: [{ ContentType: "HTML", Content: "<p>Hello</p>" }],
  },
});

console.log(data.TransactionID, data.MessageID);
```

## Project Structure

```
typescript/                       (javascript/ has the same layout with .js/.jsx)
  api/
    src/
      functions/
        send.ts                   Basic send
        sendBatch.ts              Bulk send with merge fields
        sendAttachment.ts         Attachments
        sendCid.ts                Inline (CID) image
        sendTemplate.ts           Stored template + Merge
        sendScheduled.ts          TimeOffset
        sendPreventThreading.ts   X-Entity-Ref-ID
        contacts.ts               List and add contacts
        domains.ts                List and add domains
        statistics.ts             Account statistics
        webhook.ts                Event handler (GET + POST)
        inbound.ts                Inbound email handler
        doubleOptinSubscribe.ts   Create contact + send confirm link
        doubleOptinConfirm.ts     Verify HMAC, add to list
        doubleOptinWebhook.ts     Clicked-event based confirm
      lib/
        elasticemail.ts           Configuration, API instances, event helpers
  web/
    src/
      pages/                      HomePage, SendEmailPage, AttachmentsPage, ...
      layouts/MainLayout/         Nav
      components/                 PageHeader, ResultDisplay
      Routes.tsx                  Router
      App.tsx, entry.client.tsx, index.html, index.css
  redwood.toml
  package.json                    Yarn workspaces: api, web
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
