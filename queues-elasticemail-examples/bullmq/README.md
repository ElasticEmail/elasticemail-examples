# Send Email from BullMQ - Elastic Email API

A BullMQ worker on Node.js that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API with the TypeScript SDK. Jobs live in your own Redis; the worker retries 429s, 5xx responses and network errors with exponential backoff, and moves any other 4xx straight to failed with `UnrecoverableError`.

> Part of the [Elastic Email background job examples](../README.md). New here? Start with the [background job quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · BullMQ 6 (ioredis 6, Redis 7)

## Prerequisites

- Node.js 20+
- Docker with Compose, or any Redis 5+ you can reach
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp .env.example .env      # fill in ELASTICEMAIL_API_KEY, EMAIL_FROM, EMAIL_TO
docker compose up -d      # Redis on localhost:6379
```

If 6379 is taken, `REDIS_PORT=6380 docker compose up -d` and set `REDIS_URL=redis://localhost:6380`.

## Files

| File | What it does |
|---|---|
| `src/email.ts` | `sendEmail()` (one `emailsTransactionalPost` with HTML and plain-text parts) and `classifyError()` |
| `src/queue.ts` | The `email` queue, its Redis connection from `REDIS_URL`, and the default retry policy |
| `src/worker.ts` | The worker: sends, then throws `UnrecoverableError` for permanent failures and a plain `Error` for retryable ones |
| `src/enqueue.ts` | Adds one job, or with `--fanout` one job per recipient via `addBulk` |
| `docker-compose.yml` | Redis for local development |

## Run

```bash
npm run worker     # terminal 1: processes jobs until Ctrl+C
npm run enqueue    # terminal 2: one job to EMAIL_TO
npm run fanout     # terminal 2: three jobs, one per recipient
```

Successful jobs log the `TransactionID` and `MessageID`. Failed attempts log whether the worker will retry or has given up.

In your app, the enqueue call replaces the inline send in the request handler:

```typescript
import { emailQueue } from "./queue.js";

await emailQueue.add("send", { to, subject, html, text });
res.status(202).json({ queued: true });
```

## Retries and permanent failures

The queue's `defaultJobOptions` give every job 5 attempts with exponential backoff starting at 10 seconds, with jitter so a burst of failures does not retry in lockstep:

```typescript
attempts: 5,
backoff: { type: "exponential", delay: 10_000, jitter: 0.5 },
```

The worker decides per error:

- **429, 5xx, no response:** rethrow as a normal `Error`. BullMQ schedules the next attempt after the backoff delay.
- **Any other 4xx:** throw `UnrecoverableError`. BullMQ moves the job to failed immediately, whatever attempts are left.

An unverified sender, a bad API key or an invalid payload will fail the same way on attempt five as on attempt one. Retrying those only delays the failure and keeps a slot busy. The message from `err.response.data.Error` ends up in the job's `failedReason`, so you can see why it failed. See [Which failures to retry](../README.md#which-failures-to-retry).

## Fan-out and idempotency

`npm run fanout` adds one job per recipient in one Redis round trip with `addBulk`. Each job gets a `jobId` built from a campaign name and a user id, for example `welcome-2026-09-user-1`. BullMQ does not add a job whose id already exists, so running the fan-out twice, or retrying the request that triggered it, does not queue duplicates. Custom job ids cannot contain `:`.

A job id stays taken while the job is kept in Redis, including failed jobs (`removeOnFail: 5000` keeps the last 5000). To resend a failed job, retry it (`job.retry()` or from a dashboard such as Bull Board) rather than adding it again.

When every recipient gets the same content, one bulk `emailsPost` call with merge fields is often simpler than N jobs. See [Sending email](../../docs/sending-email.md#bulk-send-with-merge-fields).

## Notes

- **The Redis connection is an ioredis instance.** BullMQ 6 in native ESM needs a constructed client rather than connection options. Workers hold blocking connections, which require `maxRetriesPerRequest: null`; `createConnection()` in `src/queue.ts` sets it.
- **BullMQ does not close connections you pass in.** `enqueue.ts` and the worker's shutdown handler call `quit()` on theirs.
- **Concurrency** is per worker process (`WORKER_CONCURRENCY`, default 5). Run more processes to scale out. If you get 429s often, lower it rather than raising the retry count.
- **Redis must not evict keys.** `docker-compose.yml` sets `maxmemory-policy noeviction`; use the same on a managed Redis.
- **Graceful shutdown:** on SIGINT or SIGTERM the worker finishes in-flight jobs before exiting, so a deploy does not cut a send in half.
- **Do not log the raw axios error.** Its `config.headers` carries the API key. The worker logs only the status and the API's message.

## AI assistant prompt

```
Write a BullMQ 6 queue and worker in TypeScript (Node.js 20, ESM) that sends email with Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x): new EmailsApi(new
Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY })) and emailsApi.emailsTransactionalPost with
Recipients.To = [to] and Content = { From: process.env.EMAIL_FROM, Subject, Body: [{ ContentType: "HTML",
Content }, { ContentType: "PlainText", Content }] }. Return TransactionID and MessageID from response.data.
Connect with new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null }) from ioredis and pass the
instance as `connection`. Default job options: attempts 5, backoff { type: "exponential", delay: 10000,
jitter: 0.5 }. In the worker, classify errors: err.response?.status 429 or >= 500, or an axios error with
no response, is retryable (rethrow); any other 4xx is permanent - throw UnrecoverableError with
err.response.data.Error. Never log the raw axios error (it contains the API key header). Add a fan-out
script using queue.addBulk with a stable jobId per recipient (no ":" in the id). Never hardcode keys.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [BullMQ docs](https://docs.bullmq.io)
- [BullMQ: retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Error handling](../../docs/error-handling.md)

## License

MIT
