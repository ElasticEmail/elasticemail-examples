# Nuxt Email API Examples - Elastic Email

Send transactional and bulk email from Nuxt 3 with the [Elastic Email](https://elasticemail.com/email-api) email API. Sending happens in Nitro server routes under `server/api/`, so the API key stays server-side. TypeScript and JavaScript variants are included.

> **First time here?** The [Nuxt quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from https://app.elasticemail.com/marketing/settings/new/manage-api

## Installation

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/nuxt-elasticemail-examples

cp .env.example typescript/.env   # or javascript/.env
cd typescript                     # or javascript
npm install
```

Edit `.env` and set at least `ELASTICEMAIL_API_KEY` and `EMAIL_FROM`. The other variables are listed in `.env.example` with a comment each. Nuxt loads `.env` in `nuxt dev` and `nuxt build`; for `node .output/server/index.mjs` export the variables yourself.

## Nuxt Application

```bash
npm run dev
```

Open http://localhost:3000. Every example has a page with a form and a result box, and calls one of the server routes below with `$fetch`.

Examples:

- Sending: basic send, attachments, CID (inline) attachments, templates with merge fields, scheduled send, prevent Gmail threading
- Events: webhook handler, inbound email handler
- Subscription: double opt-in with an HMAC-signed confirmation link (plus a Clicked-event based variant)
- Management: contacts on a list, domains and DNS verification state, account statistics

Test a route with curl:

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from Nuxt"}'
```

Webhook and inbound handlers need a public URL. Run `ngrok http 3000`, set `PUBLIC_URL` to the HTTPS URL and use `PUBLIC_URL/api/webhook?token=<ELASTICEMAIL_WEBHOOK_TOKEN>` (or `/api/inbound?token=...`) when creating the webhook or inbound route in Elastic Email. Elastic Email does not sign these requests; the token in the query string is what the handlers verify.

Typecheck (TypeScript variant): `npm run typecheck`.

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

Success responses for sends are `{ success: true, transactionId, messageId }`. Errors are `{ error }` with the status returned by the API (set with `setResponseStatus`, so the body shape stays the same as in the other stacks).

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
typescript/                        (javascript/ has the same layout with .js)
  server/
    api/
      send.post.ts                 Basic send
      send-batch.post.ts           Bulk send with merge fields
      send-attachment.post.ts      Attachments
      send-cid.post.ts             Inline (CID) image
      send-template.post.ts        Stored template + Merge
      send-scheduled.post.ts       TimeOffset
      send-prevent-threading.post.ts  X-Entity-Ref-ID
      contacts.get.ts, contacts.post.ts
      domains.get.ts, domains.post.ts
      statistics.get.ts
      webhook.ts                   Event handler (GET and POST)
      inbound.post.ts              Inbound email handler
      double-optin/
        subscribe.post.ts          Create contact + send confirm link
        confirm.get.ts             Verify HMAC, add to list
        webhook.get.ts, webhook.post.ts  Clicked-event based confirm
    utils/
      elasticemail.ts              Configuration, API instances, helpers
  pages/
    index.vue                      Index of examples
    send-email.vue, attachments.vue, cid-attachments.vue, templates.vue,
    scheduling.vue, prevent-threading.vue, contacts.vue, domains.vue,
    statistics.vue, inbound.vue, double-optin.vue, webhooks.vue
  components/
    PageHeader.vue, ResultDisplay.vue
  utils/
    errorMessage.ts                Reads { error } from a failed $fetch
  assets/main.css                  Plain CSS
  app.vue                          Nav
  nuxt.config.ts
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
