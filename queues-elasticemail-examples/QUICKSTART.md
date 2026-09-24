# Send your first email from a background job

Five minutes from a clean clone to an email sent by a BullMQ worker. Redis runs in Docker, the
worker runs on Node.js, and the send goes through the Elastic Email TypeScript SDK. For Inngest and
Trigger.dev, follow the README in their folders once this works.

## Prerequisites

- Node.js 20+
- Docker with Compose
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

Creating and managing keys is covered in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. `EMAIL_FROM`
must be on a verified domain; if it is not, the worker fails the job at once instead of retrying it.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install and configure

```bash
cd queues-elasticemail-examples/bullmq
npm install
cp .env.example .env
```

Edit `.env`:

```
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
REDIS_URL=redis://localhost:6379
```

## 4. Start Redis

```bash
docker compose up -d
```

Port 6379 already taken by another Redis? Run `REDIS_PORT=6380 docker compose up -d` and set
`REDIS_URL=redis://localhost:6380`.

## 5. Start the worker

In one terminal:

```bash
npm run worker
```

## 6. Enqueue a job

In a second terminal:

```bash
npm run enqueue
```

The enqueue script returns as soon as the job is stored in Redis. The worker picks it up and logs:

```
[1] sent to you@yourdomain.com - TransactionID ..., MessageID ...
```

Check your inbox.

## 7. Watch a permanent failure

Set `ELASTICEMAIL_API_KEY=wrong` in `.env`, restart the worker and enqueue again. The API answers
with a 4xx, the worker throws `UnrecoverableError`, and the job fails on the first attempt:

```
[2] attempt 1/5 failed - Permanent failure (400: ...) - giving up
```

A 429, a 5xx or a network error would log `will retry` instead and come back after an exponential
backoff. Put the real key back when you are done.

## 8. Fan out

```bash
npm run fanout
```

This adds one job per recipient with `addBulk`. Each job id is built from a campaign name and a user
id, so running it a second time adds nothing new.

Stop Redis with `docker compose down`.

## Next steps

- [BullMQ README](bullmq/README.md) - retry settings, idempotency and running in production
- [Inngest](inngest/README.md) and [Trigger.dev](trigger-dev/README.md) - the same pattern without running Redis
- [Which failures to retry](README.md#which-failures-to-retry)
- [Sending email](../docs/sending-email.md) - when one bulk call beats one job per recipient
