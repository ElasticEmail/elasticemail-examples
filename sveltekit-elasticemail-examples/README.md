# SvelteKit Email API Examples - Elastic Email

Send transactional and bulk email from SvelteKit 2 and Svelte 5 with the [Elastic Email](https://elasticemail.com/email-api) email API. Sending runs in `+server.ts` endpoints using `$env/dynamic/private`, so the API key stays off the client. TypeScript and JavaScript variants are included.

> **First time here?** The [SvelteKit quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain
- API key from https://app.elasticemail.com/marketing/settings/new/manage-api

## Installation

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/sveltekit-elasticemail-examples

cp .env.example typescript/.env   # or javascript/.env
cd typescript                     # or javascript
npm install
```

Edit `.env` and set at least `ELASTICEMAIL_API_KEY` and `EMAIL_FROM`. The other variables are listed in `.env.example` with a comment each. Variables are read through `$env/dynamic/private`, so they are looked up at runtime, not baked in at build time.

## SvelteKit Application

```bash
npm run dev
```

Open http://localhost:5173. Every example has a page with a form and a result box, and calls one of the `+server` routes below with `fetch`.

Examples:

- Sending: basic send, attachments, CID (inline) attachments, templates with merge fields, scheduled send, prevent Gmail threading
- Events: webhook handler, inbound email handler
- Subscription: double opt-in with an HMAC-signed confirmation link (plus a Clicked-event based variant)
- Management: contacts on a list, domains and DNS verification state, account statistics

Test a route with curl:

```bash
curl -X POST http://localhost:5173/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from SvelteKit"}'
```

Webhook and inbound handlers need a public URL. Run `ngrok http 5173`, set `PUBLIC_URL` to the HTTPS URL and use `PUBLIC_URL/api/webhook?token=<ELASTICEMAIL_WEBHOOK_TOKEN>` (or `/api/inbound?token=...`) when creating the webhook or inbound route in Elastic Email. Elastic Email does not sign these requests; the token in the query string is what the handlers verify.

Elastic Email posts these notifications form-encoded without an `Origin` header. SvelteKit's built-in CSRF check would answer 403 before the handler runs, so `kit.csrf.checkOrigin` is set to `false` in `svelte.config.js`. Turn it back on if you add form actions that need it.

Typecheck (TypeScript variant): `npm run check`. The project uses `adapter-auto`; pick an adapter (for example `@sveltejs/adapter-node`) for deployment.

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
import { env } from "$env/dynamic/private";

const config = new Configuration({ apiKey: env.ELASTICEMAIL_API_KEY });
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
typescript/                          (javascript/ has the same layout with .js)
  src/
    routes/
      api/
        send/+server.ts              Basic send
        send-batch/+server.ts        Bulk send with merge fields
        send-attachment/+server.ts   Attachments
        send-cid/+server.ts          Inline (CID) image
        send-template/+server.ts     Stored template + Merge
        send-scheduled/+server.ts    TimeOffset
        send-prevent-threading/+server.ts  X-Entity-Ref-ID
        contacts/+server.ts          GET list, POST add
        domains/+server.ts           GET list, POST add
        statistics/+server.ts        Account statistics
        webhook/+server.ts           Event handler (GET and POST)
        inbound/+server.ts           Inbound email handler
        double-optin/
          subscribe/+server.ts       Create contact + send confirm link
          confirm/+server.ts         Verify HMAC, add to list
          webhook/+server.ts         Clicked-event based confirm
      +layout.svelte                 Nav
      +page.svelte                   Index of examples
      send-email/, attachments/, cid-attachments/, templates/, scheduling/,
      prevent-threading/, contacts/, domains/, statistics/, inbound/,
      double-optin/, webhooks/       One +page.svelte each
    lib/
      server/elasticemail.ts         Configuration, API instances, helpers
      components/PageHeader.svelte, ResultDisplay.svelte
      api.ts                         fetch wrapper used by the pages
    app.css                          Plain CSS
    app.html
  svelte.config.js
  vite.config.ts
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
