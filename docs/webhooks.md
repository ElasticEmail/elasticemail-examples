# Webhooks

Elastic Email pushes delivery events to a URL you register. This is the only way to learn about
opens, clicks, bounces and complaints without polling.

## The thing to know first

**Elastic Email does not sign webhook requests.** There is no signature header to verify. Every
example therefore puts a shared secret in the URL and checks it:

```
https://your-app.example.com/webhook?token=<ELASTICEMAIL_WEBHOOK_TOKEN>
```

```typescript
const tokenOk = (token: unknown): boolean => {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};
```

Constant-time comparison, 401 on mismatch. The URL carries a secret, so it belongs in secret storage
and not in a shared log or a screenshot.

## Registering one

```typescript
const { data } = await webhookApi.webhookPost({
  Name: "examples-webhook",
  URL: `${publicUrl}/webhook?token=${encodeURIComponent(token)}`,
  NotifyOncePerEmail: false,
  NotificationForSent: true,
  NotificationForOpened: true,
  NotificationForClicked: true,
  NotificationForUnsubscribed: true,
  NotificationForAbuseReport: true,
  NotificationForError: true,
});
// data.WebhookID
```

`webhookGet(limit, offset)` lists them, `webhookByPublicidDelete(id)` removes one.

**Elastic Email sends a GET to the URL when the webhook is saved and expects a 2xx.** If your
endpoint is not reachable at that moment, the save fails. Every handler in this repository answers
`{ ok: true }` to a request that carries no `status` parameter, which covers both this validation
ping and idle health checks.

## What arrives

Events come as query parameters on a GET or form fields on a POST. The handlers merge both so one
code path covers either:

```typescript
const event = { ...req.query, ...(req.body ?? {}) };
```

| Parameter | Meaning |
|---|---|
| `status` | `Sent`, `Opened`, `Clicked`, `Error`, `AbuseReport`, `Unsubscribed` |
| `to` | Recipient address |
| `from`, `subject`, `date` | Message headers |
| `transaction` | `TransactionID` from the original send |
| `messageid` | `MessageID` from the original send |
| `category` | Failure category on an `Error` event |
| `target` | The clicked URL, on a `Clicked` event |
| `channel` | Channel name, when the send set one |
| `IP`, `Useragent`, `Country`, `City` | Where the open or click came from |

Note the inconsistent casing: `status` and `to` are lowercase, `IP` and `Country` are not. Read them
exactly as listed.

## Handling the events

```typescript
switch (status) {
  case "Sent":         /* accepted by the receiving server */ break;
  case "Opened":       /* tracking pixel loaded */ break;
  case "Clicked":      /* event.target holds the URL */ break;
  case "Error":        /* bounce; event.category says what kind */ break;
  case "AbuseReport":  /* spam complaint - suppress immediately */ break;
  case "Unsubscribed": /* opt-out */ break;
}
```

What each one is worth in practice:

- `Sent` means the receiving server accepted it, not that a human saw it.
- `Opened` undercounts badly. Image blocking is the default in most clients, and privacy proxies
  inflate it in the other direction. Treat it as a trend, not a fact about one person.
- `Clicked` requires click tracking, which rewrites links through a tracking domain.
- `Error` with a hard bounce category should stop future sends to that address.
- `AbuseReport` is the one to act on immediately. Suppress, and find out which send caused it.

## Writing a handler that survives production

- **Answer fast, work later.** Return 2xx and hand the event to a queue. A slow handler causes retries
  and duplicates.
- **Expect duplicates.** `NotifyOncePerEmail: false` means several events per message, and retries
  can repeat one. Key your processing on `messageid` plus `status`.
- **Never log raw event values.** They are attacker-controlled. The examples strip `\r` and `\n`
  with `sanitize()` before anything reaches a log line.
- **Do not assume ordering.** `Opened` can arrive before `Sent` finishes processing on your side.

## Local development

Elastic Email has to reach the URL, so `localhost` will not do:

```bash
ngrok http 3000
# set PUBLIC_URL to the https URL ngrok prints, restart the app, then create the webhook
```

Simulate an event without waiting for a real one:

```bash
curl -X POST "http://localhost:3000/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"

curl -X POST "http://localhost:3000/webhook?token=change_me" \
  -d "status=Clicked&to=you@yourdomain.com&target=https://example.com/pricing"
```

## Framework-specific traps

| Stack | Trap |
|---|---|
| SvelteKit | The built-in CSRF check rejects form posts without an `Origin` header before the handler runs. `kit.csrf.checkOrigin` is set to `false` in `svelte.config.js` for this reason. |
| Express | Needs `express.urlencoded()` mounted, or the form fields never appear in `req.body`. The examples raise its limit to `25mb` for inbound mail. |
| Supabase Edge Functions | Set `verify_jwt = false` for the webhook function - Elastic Email posts no JWT. |
| RedwoodJS | Functions receive an API Gateway style event; form bodies are parsed with `URLSearchParams`. |
| Next.js, Remix, Astro, Nuxt, TanStack | Handlers accept both GET and POST so the save-time validation ping succeeds. |

## In this repository

- `webhooks` in every stack creates, lists and deletes a webhook.
- The server apps expose `GET|POST /webhook?token=...` with the full event switch.
- `double-optin-webhook` shows a handler that acts on one specific event type.
