# Astro Email API Examples - Elastic Email

Send transactional and bulk email from an Astro site with the [Elastic Email](https://elasticemail.com/email-api) email API. Astro 5 runs in server mode with the Node adapter, so your API key stays on the server and never reaches the browser. TypeScript and JavaScript variants are included.

> **First time here?** The [Astro quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · Astro 5

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/astro-elasticemail-examples

cp .env.example typescript/.env   # or javascript/.env
cd typescript                     # or javascript
npm install
```

Edit `.env` and set at least `ELASTICEMAIL_API_KEY` and `EMAIL_FROM`. The other variables are listed in `.env.example` with a comment each.

## Astro Application

```bash
npm run dev
```

Open http://localhost:4321. Every example has a page with a form and a result box. The pages are plain `.astro` files with a small `<script>` that posts JSON to the API endpoints below, so the same endpoints work from curl.

Examples:

- Sending: basic send, attachments, CID (inline) attachments, templates with merge fields, scheduled send, prevent Gmail threading
- Events: webhook handler, inbound email handler
- Subscription: double opt-in with an HMAC-signed confirmation link (plus a Clicked-event based variant)
- Management: contacts on a list, domains and DNS verification state, account statistics

Test an endpoint with curl:

```bash
curl -X POST http://localhost:4321/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from Astro"}'
```

Webhook and inbound handlers need a public URL. Run `ngrok http 4321`, set `PUBLIC_URL` to the HTTPS URL and use `PUBLIC_URL/api/webhook?token=<ELASTICEMAIL_WEBHOOK_TOKEN>` (or `/api/inbound?token=...`) when creating the webhook or inbound route in Elastic Email. Elastic Email does not sign these requests; the token in the query string is what the handlers verify.

Production build: `npm run build && npm start`. The standalone Node server reads `process.env` only, so export the variables from `.env` first (for example `node --env-file=.env dist/server/entry.mjs`). `npm run check` runs `astro check` (TypeScript variant).

## API Endpoints

| Method | Path | Body / query | Elastic Email call |
|---|---|---|---|
| POST | `/api/send` | `{ to, subject, message }` | `emailsTransactionalPost` |
| POST | `/api/send-batch` | `{ to }` | `emailsPost` with per-recipient `Fields` |
| POST | `/api/send-attachment` | `{ to }` | `emailsTransactionalPost` with `Attachments` |
| POST | `/api/send-cid` | `{ to }` | `emailsTransactionalPost`, `<img src="cid:logo.png">` |
| POST | `/api/send-template` | `{ to, firstName?, company? }` | `templatesByNameGet` / `templatesPost`, then send with `TemplateName` + `Merge` |
| POST | `/api/send-scheduled` | `{ to, delayMinutes? }` | `emailsTransactionalPost` with `Options.TimeOffset` |
| POST | `/api/send-prevent-threading` | `{ to, count? }` | 3 sends with `Headers["X-Entity-Ref-ID"]` |
| GET | `/api/contacts` | | `listsByListnameContactsGet` |
| POST | `/api/contacts` | `{ email, firstName?, lastName? }` | `listsPost` (ignore exists), `contactsPost(..., [listName])` |
| GET | `/api/domains` | | `domainsGet` |
| POST | `/api/domains` | `{ domain? }` | `domainsPost`, `domainsByDomainGet` |
| GET | `/api/statistics` | `?days=30` | `statisticsGet(from, to)` |
| GET, POST | `/api/webhook` | `?token=...` + event params | token check, log per `status` |
| POST | `/api/inbound` | `?token=...` + form fields | token check, forward to `CONTACT_EMAIL` |
| POST | `/api/double-optin/subscribe` | `{ email, name? }` | `contactsPost` (Transactional), send confirm link |
| GET | `/api/double-optin/confirm` | `?email=&token=` | HMAC check, `listsByNameContactsPost` |
| GET, POST | `/api/double-optin/webhook` | `?token=...` + event params | on `Clicked` of the confirm URL, `listsByNameContactsPost` |

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
typescript/                       (javascript/ has the same layout with .js)
  src/
    pages/
      api/
        send.ts                   Basic send
        send-batch.ts             Bulk send with merge fields
        send-attachment.ts        Attachments
        send-cid.ts               Inline (CID) image
        send-template.ts          Stored template + Merge
        send-scheduled.ts         TimeOffset
        send-prevent-threading.ts X-Entity-Ref-ID
        contacts.ts               List and add contacts
        domains.ts                List and add domains
        statistics.ts             Account statistics
        webhook.ts                Event handler (GET + POST)
        inbound.ts                Inbound email handler
        double-optin/
          subscribe.ts            Create contact + send confirm link
          confirm.ts              Verify HMAC, add to list
          webhook.ts              Clicked-event based confirm
      index.astro                 Index of examples
      send-email.astro, attachments.astro, cid-attachments.astro, templates.astro,
      scheduling.astro, prevent-threading.astro, contacts.astro, domains.astro,
      statistics.astro, inbound.astro, double-optin.astro, webhooks.astro
    components/
      PageHeader.astro, ResultDisplay.astro
    layouts/
      Layout.astro                Nav
    lib/
      elasticemail.ts             Configuration, API instances, helpers
      client.ts                   Browser helpers used by the page scripts
    styles.css                    Plain CSS
  astro.config.mjs                output: "server", @astrojs/node
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
