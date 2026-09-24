# Send Email from Trigger.dev - Elastic Email API

A Trigger.dev task that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API with the TypeScript SDK. Your app triggers `send-email` and returns; Trigger.dev queues the run, executes it on its own compute, retries 429s, 5xx responses and network errors with exponential backoff, and ends the run at once on other 4xx responses via `AbortTaskRunError`.

> Part of the [Elastic Email background job examples](../README.md). New here? The [background job quickstart](../QUICKSTART.md) shows the same pattern with BullMQ.

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · Trigger.dev 4 (`@trigger.dev/sdk`)

## Prerequisites

- Node.js 20+
- A [Trigger.dev](https://trigger.dev) account and project (Trigger.dev Cloud or self-hosted). `trigger dev` connects to it even for local runs.
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp .env.example .env
npx trigger.dev@latest login
```

Fill in `.env`:

- `ELASTICEMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_TO`
- `TRIGGER_PROJECT_REF` - from Project settings in the Trigger.dev dashboard (`proj_...`). `trigger.config.ts` reads it.
- `TRIGGER_SECRET_KEY` - the DEV secret key from the API keys page. The enqueue script uses it to trigger runs.

## Files

| File | What it does |
|---|---|
| `src/email.ts` | `sendEmail()` (one `emailsTransactionalPost` with HTML and plain-text parts) and `classifyError()` |
| `src/trigger/send-email.ts` | The `send-email` task: retry policy, concurrency limit, `AbortTaskRunError` for permanent failures |
| `src/enqueue.ts` | Triggers one run, or with `--fanout` a batch of one run per recipient |
| `trigger.config.ts` | Project ref, task directory, `maxDuration`, retries enabled in dev |

## Run

```bash
npm run dev          # terminal 1: `trigger dev` - registers the task and runs it on your machine
npm run enqueue      # terminal 2: one run
npm run fanout       # terminal 2: a batch of three runs
```

`npm run dev` is `trigger dev` from the local `trigger.dev` package; `npx trigger.dev@latest dev` does the same. It loads `.env`, so the task sees `ELASTICEMAIL_API_KEY` and `EMAIL_FROM`. Each run, its output (`transactionId`, `messageId`) and every retry show up in the dashboard.

In your app, trigger the task with a type-only import so the task code is not bundled into your server:

```typescript
import { tasks } from "@trigger.dev/sdk";
import type { sendEmailTask } from "./trigger/send-email.js";

await tasks.trigger<typeof sendEmailTask>("send-email", { to, subject, html, text });
```

## Retries and permanent failures

```typescript
task({
  id: "send-email",
  retry: { maxAttempts: 5, factor: 2, minTimeoutInMs: 10_000, maxTimeoutInMs: 120_000, randomize: true },
  queue: { concurrencyLimit: 5 },
  run: async (payload) => { /* send, classify, throw */ },
});
```

Five attempts in total, waiting roughly 10, 20, 40 and 80 seconds between them. In `run`:

- **429, 5xx, no response:** rethrow as a normal `Error`. Trigger.dev schedules the next attempt.
- **Any other 4xx:** throw `AbortTaskRunError`. The run fails immediately, whatever attempts are left.

An unverified sender or a bad API key fails the same way on every attempt, so retrying it only burns attempts and delays the alert. The API's `err.response.data.Error` is in the error message on the failed run. See [Which failures to retry](../README.md#which-failures-to-retry).

`trigger.config.ts` sets `retries.enabledInDev: true` so retries behave the same under `trigger dev` as in production.

## Fan-out and idempotency

`npm run fanout` calls `tasks.batchTrigger` with one item per recipient. Each item carries an `idempotencyKey` built from the campaign and the user id, for example `welcome-2026-09-user-1`, with a 7-day TTL. Triggering the same key again returns the existing run instead of starting a new one, so a retried request or a re-run script does not send twice.

When every recipient gets the same content, one bulk `emailsPost` call with merge fields is often simpler than N runs. See [Sending email](../../docs/sending-email.md#bulk-send-with-merge-fields).

## Deploy

```bash
npx trigger.dev@latest deploy
```

Then set `ELASTICEMAIL_API_KEY` and `EMAIL_FROM` as environment variables for the Production environment in the Trigger.dev dashboard; the local `.env` is not uploaded. Your app triggers runs with the PROD `TRIGGER_SECRET_KEY`.

## Notes

- **The task runs on Trigger.dev's compute, not in your server.** Your app only needs `@trigger.dev/sdk` and the secret key to trigger it.
- **`queue.concurrencyLimit`** caps concurrent sends across all runs. If the API answers 429 often, lower it rather than raising `maxAttempts`.
- **`maxDuration`** in `trigger.config.ts` stops a run that hangs; a single send finishes well inside it.
- **Do not log the raw axios error.** Its `config.headers` carries the API key. The task logs only the status and the API's message.

## AI assistant prompt

```
Write a Trigger.dev v4 task in TypeScript that sends email with Elastic Email. Use the npm package
@elasticemail/elasticemail-client-ts-axios (version 4.x): new EmailsApi(new Configuration({ apiKey:
process.env.ELASTICEMAIL_API_KEY })) and emailsApi.emailsTransactionalPost with Recipients.To = [to] and
Content = { From: process.env.EMAIL_FROM, Subject, Body: [{ ContentType: "HTML", Content },
{ ContentType: "PlainText", Content }] }. Define task({ id: "send-email", retry: { maxAttempts: 5,
factor: 2, minTimeoutInMs: 10000, maxTimeoutInMs: 120000, randomize: true }, run }) from
"@trigger.dev/sdk". In run, err.response?.status 429 or >= 500, or an axios error with no response, is
retryable (rethrow); any other 4xx is permanent - throw AbortTaskRunError with err.response.data.Error.
Return { transactionId, messageId }. Add a trigger.config.ts with defineConfig({ project:
process.env.TRIGGER_PROJECT_REF, dirs: ["./src/trigger"], maxDuration: 60 }) and a script that fans out
with tasks.batchTrigger, one item per recipient with a stable idempotencyKey. Never hardcode keys.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Trigger.dev docs](https://trigger.dev/docs)
- [Trigger.dev: errors and retrying](https://trigger.dev/docs/errors-retrying)
- [Trigger.dev: idempotency](https://trigger.dev/docs/idempotency)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Error handling](../../docs/error-handling.md)

## License

MIT
