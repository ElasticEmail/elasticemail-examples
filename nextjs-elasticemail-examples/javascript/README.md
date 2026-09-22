# Next.js Email API Examples (JavaScript) - Elastic Email

Send transactional and bulk email from Next.js 15 (App Router) with the [Elastic Email](https://elasticemail.com/email-api) email API, in plain JavaScript. Every call runs in a Route Handler on the server, so the API key never ships to the client. The [TypeScript variant](../typescript/) is identical in behaviour.

> **First time here?** The [Next.js quickstart](../QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../../docs/README.md).

## Prerequisites

- Node.js 18.18+ (20 or 22 recommended)
- An Elastic Email account with a verified sender domain
- API key from https://app.elasticemail.com/marketing/settings/new/manage-api

## Installation

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/nextjs-elasticemail-examples/javascript

npm install
cp .env.example .env
```

Edit `.env` and set at least `ELASTICEMAIL_API_KEY` and `EMAIL_FROM`. The other variables are listed in `.env.example` with a comment each.

## Next.js Application

```bash
npm run dev
```

Open http://localhost:3000. Every example has a page with a form and a result box, and calls one of the API routes below.

Examples:

- Sending: basic send, attachments, CID (inline) attachments, templates with merge fields, scheduled send, prevent Gmail threading
- Contact form: Server Action that sends a confirmation to the visitor and a notification to `CONTACT_EMAIL`
- Events: webhook handler, inbound email handler
- Subscription: double opt-in with an HMAC-signed confirmation link (plus a Clicked-event based variant)
- Management: contacts on a list, domains and DNS verification state, account statistics

Test a route with curl:

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from Next.js"}'
```

Webhook and inbound handlers need a public URL. Run `ngrok http 3000`, set `PUBLIC_URL` to the HTTPS URL and use `PUBLIC_URL/api/webhook?token=<ELASTICEMAIL_WEBHOOK_TOKEN>` (or `/api/inbound?token=...`) when creating the webhook or inbound route in Elastic Email. Elastic Email does not sign these requests; the token in the query string is what the handlers verify.

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
| POST | `/double-optin/subscribe` | `{ email, name? }` | `contactsPost` (Transactional), send confirm link |
| GET | `/double-optin/confirm` | `?email=&token=` | HMAC check, `listsByNameContactsPost` |
| GET, POST | `/double-optin/webhook` | `?token=...` + event params | on `Clicked` of the confirm URL, `listsByNameContactsPost` |

Success responses for sends are `{ success: true, transactionId, messageId }`. Errors are `{ error }` with the status returned by the API.

## Quick Usage

```javascript
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
src/
  app/
    api/
      send/                    Basic send
      send-batch/              Bulk send with merge fields
      send-attachment/         Attachments
      send-cid/                Inline (CID) image
      send-template/           Stored template + Merge
      send-scheduled/          TimeOffset
      send-prevent-threading/  X-Entity-Ref-ID
      contacts/                List and add contacts
      domains/                 List and add domains
      statistics/              Account statistics
      webhook/                 Event handler
      inbound/                 Inbound email handler
    double-optin/
      subscribe/               Create contact + send confirm link
      confirm/                 Verify HMAC, add to list
      webhook/                 Clicked-event based confirm
      page.jsx                 Subscribe form
    contact-form/              Server Action example
    send-email/, attachments/, cid-attachments/, templates/, scheduling/,
    prevent-threading/, contacts/, domains/, statistics/, inbound/, webhooks/
    layout.jsx                 Nav
    page.jsx                   Index of examples
    globals.css                Plain CSS
  components/
    page-header.jsx, result-display.jsx, code-block.jsx
  lib/
    elasticemail.js            Configuration, API instances, helpers
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email JavaScript/TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
