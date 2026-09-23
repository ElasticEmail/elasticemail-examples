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

**Saving a webhook sends a test event.** As soon as you save, Elastic Email calls the URL once and
keeps the webhook only if the response is 2xx. If your endpoint is not reachable at that moment, the
save fails.

The test event looks like a real one, with sample values:

```
?token=...&transaction=<random id>&to=test@test.com&from=fromTest@test.com&account=account@test.com
 &status=opened&channel=testchannel&category=sent&subject=test&messageid=abc1234
```

Your `token` is included because it is part of the URL you registered, so the token check passes.
The handlers in this repository accept the test event and log it. In your own app, skip it before it
reaches your database, for example by ignoring events where `messageid` is `abc1234`.

## What arrives

Every event is a GET request with the details in the query string. There is no request body. The
handlers also merge in form fields, so a test POST from curl works too:

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
| `account` | Email address of the Elastic Email account that sent the message |
| `postback` | The `Postback` value you set on the send, if any |
| `ip`, `useragent`, `country`, `state`, `city` | Where the open or click came from |

All parameter names are lowercase. Values are case-sensitive where they matter: a real event has
`status=Opened`, while the save-time test event has `status=opened`.

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
curl "http://localhost:3000/webhook?token=change_me&status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"

curl "http://localhost:3000/webhook?token=change_me&status=Clicked&to=you@yourdomain.com&target=https%3A%2F%2Fexample.com%2Fpricing"
```

## Framework-specific traps

| Stack | Trap |
|---|---|
| SvelteKit | The built-in CSRF check rejects form posts without an `Origin` header before the handler runs. Inbound email arrives as exactly that kind of post. `kit.csrf.checkOrigin` is set to `false` in `svelte.config.js` for this reason. |
| Express | Needs `express.urlencoded()` mounted, or inbound email's form fields never appear in `req.body`. The examples raise its limit to `25mb` for inbound mail. |
| Supabase Edge Functions | Set `verify_jwt = false` for the webhook function - Elastic Email sends no JWT. |
| RedwoodJS | Functions receive an API Gateway style event; form bodies are parsed with `URLSearchParams`. |
| Next.js, Remix, Astro, Nuxt, TanStack | A route that only exports `POST` answers 405 to Elastic Email's GET, and saving the webhook fails. The handlers export both GET and POST. |

## In this repository

- `webhooks` in every stack creates, lists and deletes a webhook.
- The server apps expose `GET|POST /webhook?token=...` with the full event switch.
- `double-optin-webhook` shows a handler that acts on one specific event type.
