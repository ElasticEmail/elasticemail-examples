# Send Email from Inngest - Elastic Email API

Inngest functions that send transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API with the TypeScript SDK. Your app sends an `email/send.requested` event and returns; Inngest runs the send as a step on your Node.js server, retries it with backoff on 429, 5xx and network errors, and stops at once on other 4xx responses via `NonRetriableError`. There is no queue or Redis to operate.

> Part of the [Elastic Email background job examples](../README.md). New here? The [background job quickstart](../QUICKSTART.md) shows the same pattern with BullMQ.

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · Inngest TypeScript SDK 4 (`inngest/node` handler)

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))
- For production: an [Inngest](https://www.inngest.com) account. Local development needs no account.

## Setup

```bash
npm install
cp .env.example .env      # fill in ELASTICEMAIL_API_KEY, EMAIL_FROM, EMAIL_TO
```

`.env.example` sets `INNGEST_DEV=1`. SDK v4 defaults to cloud mode, which requires a signing key; `INNGEST_DEV=1` points it at the local dev server instead.

## Files

| File | What it does |
|---|---|
| `src/email.ts` | `sendEmail()` (one `emailsTransactionalPost` with HTML and plain-text parts) and `classifyError()` |
| `src/client.ts` | The Inngest client and the two typed events, `email/send.requested` and `email/fanout.requested` |
| `src/functions.ts` | `send-email` (one send in `step.run("send")`, 4 retries) and `email-fanout` (one event per recipient) |
| `src/server.ts` | A `node:http` server exposing `/api/inngest` (the `inngest/node` handler) and `/health` |
| `src/enqueue.ts` | Sends one event, or with `--fanout` one fan-out event |

## Run

```bash
npm run dev             # terminal 1: your server on http://localhost:3000
npm run inngest:dev     # terminal 2: Inngest dev server, UI on http://localhost:8288
npm run enqueue         # terminal 3: one send
npm run fanout          # terminal 3: fan-out to three recipients
```

`inngest:dev` runs `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`, which registers your functions with the local dev server. Open http://localhost:8288 to see each run, its step output (`transactionId`, `messageId`) and every retry.

In your app, the event replaces the inline send in the request handler:

```typescript
import { inngest, sendRequested } from "./client.js";

await inngest.send(sendRequested.create({ to, subject, html, text }));
```

## Retries and permanent failures

```typescript
inngest.createFunction(
  { id: "send-email", triggers: [sendRequested], retries: 4, concurrency: { limit: 5 } },
  async ({ event, step }) => step.run("send", async () => { /* send, classify, throw */ }),
);
```

`retries: 4` means one try plus four retries, spaced out by Inngest's exponential backoff. Inside the step:

- **429, 5xx, no response:** rethrow as a normal `Error`. Inngest retries the step.
- **Any other 4xx:** throw `NonRetriableError`. The run fails immediately, whatever retries are left.

A bad key, an unverified sender or a suppressed recipient will not start working on the next attempt, so retrying it only delays the failure. The API's `err.response.data.Error` is in the error message, visible on the failed run. See [Which failures to retry](../README.md#which-failures-to-retry).

`concurrency: { limit: 5 }` caps concurrent sends across every server running this function. If the API answers 429 often, lower it, or add a `throttle` to the function.

## Fan-out and idempotency

`email-fanout` takes one event with a list of recipients and uses `step.sendEvent` to emit one `email/send.requested` event each. Every event carries an `id` built from the campaign and the user id, for example `welcome-2026-09-user-1`. Inngest ignores a second event with an id it has already seen within its deduplication window, so replaying the fan-out does not send twice. Each recipient gets its own run, its own retries and its own failure.

When every recipient gets the same content, one bulk `emailsPost` call with merge fields is often simpler than N runs. See [Sending email](../../docs/sending-email.md#bulk-send-with-merge-fields).

## Deploy

1. Deploy the server anywhere that runs Node.js and is reachable over HTTPS.
2. In Inngest Cloud, create an app pointing at `https://<your-host>/api/inngest`.
3. Set `ELASTICEMAIL_API_KEY`, `EMAIL_FROM`, `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` on the server, and remove `INNGEST_DEV`.

The signing key lets the handler reject requests that do not come from Inngest.

## Notes

- **Triggers live in the options object.** In SDK v4, `createFunction({ id, triggers: [...] }, handler)` replaces the v3 three-argument form. Event types come from `eventType()` with `staticSchema<T>()` (type-only) or a Zod schema (validated at runtime).
- **Step output is JSON.** `step.run` stores its return value, so return plain data such as `{ transactionId, messageId }`.
- **Do not pass the axios error as `cause`.** Inngest serializes the cause into the run and your logs, and the axios error's `config.headers` carries the API key.
- **The payload types are type aliases, not interfaces.** Event data must be assignable to `Record<string, unknown>`, which interfaces are not.

## AI assistant prompt

```
Write Inngest functions (TypeScript, inngest SDK v4, Node.js 20 ESM) that send email with Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x): new EmailsApi(new
Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY })) and emailsApi.emailsTransactionalPost with
Recipients.To = [to] and Content = { From: process.env.EMAIL_FROM, Subject, Body: [{ ContentType: "HTML",
Content }, { ContentType: "PlainText", Content }] }. Define the event with eventType("email/send.requested",
{ schema: staticSchema<...>() }) and a function inngest.createFunction({ id: "send-email", triggers: [event],
retries: 4 }, async ({ event, step }) => step.run("send", ...)). Inside the step, err.response?.status 429
or >= 500, or an axios error with no response, is retryable (rethrow); any other 4xx is permanent - throw
NonRetriableError with err.response.data.Error, without passing the axios error as cause. Add a fan-out
function that calls step.sendEvent with one event per recipient and a stable event id. Serve with
serve() from "inngest/node" at /api/inngest. Use INNGEST_DEV=1 locally. Never hardcode keys.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Inngest docs](https://www.inngest.com/docs)
- [Inngest: errors and retries](https://www.inngest.com/docs/guides/error-handling)
- [Inngest: v3 to v4 migration](https://www.inngest.com/docs/reference/typescript/v4/migrations/v3-to-v4)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Error handling](../../docs/error-handling.md)

## License

MIT
