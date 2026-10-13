# Background Email Job Examples - Elastic Email

Send email from a background job instead of inside the web request, with the [Elastic Email](https://elasticemail.com/email-api) email API and the TypeScript SDK `@elasticemail/elasticemail-client-ts-axios`. Your request handler enqueues a job and answers right away; a worker makes the API call with an `Idempotency-Key` derived from the job, retries it with backoff when a call fails with a 5xx, 409 or 429, and gives up at once on errors that retrying cannot fix. Three Node.js projects cover the same pattern on three job runners: BullMQ on your own Redis, and the managed services Inngest and Trigger.dev.

> **First time here?** The [background job quickstart](QUICKSTART.md) runs BullMQ and Redis locally with Docker Compose and gets a job through the worker in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Why a background job

- **The request stays fast.** The user does not wait on an outbound API call, and a slow or failing send does not turn into a failed page load.
- **Retries survive restarts.** The job is stored before it runs, so a deploy, a crash or a network blip in the middle of a send gets retried instead of lost.
- **You control the pace.** A worker's concurrency setting limits how many sends are in flight, and a 429 becomes a delayed retry instead of an error shown to a user.
- **Fan-out is cheap.** One "send to these people" request becomes one job per recipient, so one bad address fails alone while the rest go out.

## Projects

| Folder | Runner | Hosting | Where retries are configured | Idempotency-Key from | Permanent failure | Fan-out | Local dev |
|---|---|---|---|---|---|---|---|
| [bullmq](bullmq/) | [BullMQ](https://docs.bullmq.io) 6 | Self-hosted: your Redis, your worker process | `attempts` + a custom `backoff` that honours `Retry-After` | `job.id` + `job.timestamp` | `throw new UnrecoverableError()` | `queue.addBulk()` with a stable `jobId` | `docker compose up -d` |
| [inngest](inngest/) | [Inngest](https://www.inngest.com/docs) 4 | Managed queue and scheduler; your server runs the code over HTTP | `retries` on the function; `RetryAfterError` for `Retry-After` | the event `id` (fallback `runId`) | `throw new NonRetriableError()` | `step.sendEvent()` with a stable event `id` | `npx inngest-cli@latest dev` |
| [trigger-dev](trigger-dev/) | [Trigger.dev](https://trigger.dev/docs) 4 | Managed queue and managed compute (or self-hosted Trigger.dev) | `retry` on the task; `catchError` for `Retry-After` | `ctx.run.id` | `throw new AbortTaskRunError()` | `tasks.batchTrigger()` with an `idempotencyKey` per item | `npx trigger.dev@latest dev` |

Pick BullMQ when you already run Redis and want everything in your own infrastructure. Pick Inngest or Trigger.dev when you would rather not operate a queue and want a dashboard with run history and replays out of the box.

## Which failures to retry

Every project uses the same classifier in `src/email.ts`. It reads the status from the axios error (`err.response?.status`) and the API's message from `err.response.data.Error`:

| What happened | Example | Retry? | Why |
|---|---|---|---|
| 429 | Too many requests (the v4 API doesn't rate limit today; a proxy might) | Yes, with backoff | It will succeed once you send less often. |
| 409 | `Request with this Idempotency-Key is in progress` | Yes, with backoff | An earlier attempt of this job is still being processed; the retry gets its result. |
| 503 | `Idempotency-Key` couldn't be confirmed | Yes, after `Retry-After` | Nothing was sent. The same key on the next attempt is safe. |
| Other 5xx | Temporary server-side problem | Yes, with backoff | Usually gone on the next attempt. |
| No response | Timeout, DNS failure, connection reset | Yes, with backoff | The request may or may not have arrived; the key makes the retry safe either way. |
| 422 | `Idempotency-Key was already used with a different request` | No, fail now | A bug: the body changed between attempts, or two jobs share a key. |
| Any other 4xx | 400 invalid payload, unverified sender, bad key (`APIKey Expired`) or missing access level (`Access Denied.`); 412 account limit; 413 too many recipients | No, fail now | The same request will fail the same way. |
| Not an HTTP error | A missing env var, a bug in your code | No, fail now | Needs a fix and a redeploy, not another attempt. |

Why not retry everything? A 4xx describes the request, not the moment. A sender on a domain you have not verified, a suppressed recipient or a revoked API key will not fix itself in the next few minutes. Retrying it only burns attempts, delays the failure alert and keeps the job sitting in the queue. Fail it once, log `err.response.data.Error`, and fix the cause. Status codes and their usual causes are in [Error handling](../docs/error-handling.md).

## Retries without duplicate emails

A request can time out after Elastic Email accepted it. Retried blindly, that send would deliver a second copy. So every send carries an `Idempotency-Key` header built from something that stays the same across all attempts of one job: the BullMQ job id (plus the time the job was added), the Inngest event id, or the Trigger.dev run id, never the attempt number. If an earlier attempt already went through, the retry gets that attempt's stored response (same `TransactionID`, with `Idempotency-Replayed: true`) and nothing is sent twice. The worker logs it as "already sent by an earlier attempt". Keys are kept for 24 hours, far longer than any retry schedule here.

That only works if every attempt sends the same bytes: the message is built in `src/email.ts` from the job data and `EMAIL_FROM` alone, with no timestamps or random values. If you change that, keep it deterministic, or a retry gets a `422`.

There are two layers, and you want both:

- **Job-level idempotency** (BullMQ `jobId`, the Inngest event `id`, the Trigger.dev `idempotencyKey` on trigger) stops the same email being *enqueued* twice, for example when the request that triggered the fan-out is retried.
- **The `Idempotency-Key` on the API call** stops one job *sending* twice when its attempts overlap with a request that already went through.

Details and status codes: [Retrying safely](../docs/sending-email.md#retrying-safely-idempotency-key).

## One job per recipient, or one bulk call

Fan-out gives each recipient their own job, their own retries and their own failure. That is right for transactional mail where each message differs: receipts, password resets, notifications.

When many recipients get the same content, one bulk `emailsPost` call with per-recipient merge fields is often better than N jobs: one API request, one `TransactionID` for the whole send, and Elastic Email handles the delivery to each recipient. You can still run that single call inside one background job. See [Sending email](../docs/sending-email.md#bulk-send-with-merge-fields).

## Environment variables

```
ELASTICEMAIL_API_KEY   API key
EMAIL_FROM             sender on a verified domain, e.g. Acme <hello@yourdomain.com>
EMAIL_TO               test recipient
REDIS_URL              BullMQ only, default redis://localhost:6379
INNGEST_DEV            Inngest only, 1 for the local dev server
INNGEST_EVENT_KEY      Inngest only, production
INNGEST_SIGNING_KEY    Inngest only, production
TRIGGER_PROJECT_REF    Trigger.dev only, project ref for trigger.config.ts
TRIGGER_SECRET_KEY     Trigger.dev only, used by the code that triggers tasks
```

Each folder has its own `.env.example`. The full list for the repository is in [Environment variables](../docs/environment-variables.md).

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))
- Docker for BullMQ's local Redis, or an Inngest or Trigger.dev account for deploying those two

## Checking a change

```bash
cd bullmq        # or inngest, trigger-dev
npm install
npm run typecheck
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [BullMQ: retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [Inngest: errors and retries](https://www.inngest.com/docs/guides/error-handling)
- [Trigger.dev: errors and retrying](https://trigger.dev/docs/errors-retrying)

## License

MIT
