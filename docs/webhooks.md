# Webhooks

Elastic Email pushes delivery events to a URL you register. This is the only way to learn about
opens, clicks, bounces and complaints without polling.

## The thing to know first

**Signing is opt-in, and it is chosen when the webhook is created.** A webhook created with
`EnableSigning: true` signs every request with HMAC-SHA256, using a secret that Elastic Email returns
**once**, in the create response. With `DeliveryMethod: "PostJson"` events arrive as a `POST` with a
JSON body instead of a `GET` with a query string. Neither option can be switched on or off later.

A webhook created without them, including every webhook created before signing existed, sends
**unsigned `GET`** requests. Those can only be protected with a shared secret in the URL.

Every handler in this repository supports both:

| `ELASTICEMAIL_WEBHOOK_SECRET` | What the handler does |
|---|---|
| set (recommended) | Requires a valid `X-ElasticEmail-Signature`, reads the event from the JSON body (`POST`) or the query string (`GET`), answers 401 otherwise |
| empty | Falls back to the `?token=<ELASTICEMAIL_WEBHOOK_TOKEN>` check, for unsigned webhooks |

## Registering one

```typescript
import { WebhookApi, WebhookDeliveryMethod } from "@elasticemail/elasticemail-client-ts-axios";

const { data } = await webhookApi.webhookPost({
  Name: "examples-webhook",
  URL: `${publicUrl}/webhook`,
  NotifyOncePerEmail: false,
  NotificationForSent: true,
  NotificationForOpened: true,
  NotificationForClicked: true,
  NotificationForUnsubscribed: true,
  NotificationForAbuseReport: true,
  NotificationForError: true,
  EnableSigning: true,
  DeliveryMethod: WebhookDeliveryMethod.PostJson,
});
// data.WebhookID, and data.SigningSecret - shown only now: store it as ELASTICEMAIL_WEBHOOK_SECRET
```

`webhookGet(limit, offset)` lists webhooks, `webhookByPublicidSecretRotatePost(id)` replaces the
secret (and returns the new one, only in that response), `webhookByPublicidDelete(id)` removes one.
The SDK method names in every language are in [api-map.md](api-map.md). Signing needs the SDKs at
4.3.0 or later.

For an unsigned webhook, leave out `EnableSigning` and `DeliveryMethod` and put the token in the URL:
`${publicUrl}/webhook?token=${encodeURIComponent(token)}`.

## Verifying a signed request

Signed requests carry three headers:

| Header | Value |
|---|---|
| `X-ElasticEmail-Timestamp` | Unix time in seconds when the request was sent |
| `X-ElasticEmail-Signature` | `v1=<lowercase hex>`. Treat it as a comma-separated list and accept the request if any `v1=` entry matches. |
| `X-ElasticEmail-Webhook-Id` | The webhook's ID, to pick the right secret when several webhooks share an endpoint |

The signature is computed over four parts joined by a line feed:

```
signature = hex(HMAC-SHA256(key = secret, message = "{timestamp}\n{METHOD}\n{request target}\n{raw body}"))
```

- `request target` is the path and query string **exactly as received**, still URL-encoded
  (`req.originalUrl` in Express, `RAW_URI`/`REQUEST_URI` in Python and PHP, `r.RequestURI` in Go,
  `pathname + search` of the request URL in Fetch-API runtimes).
- `raw body` is the body bytes **before** any JSON parsing. A `GET` has an empty body.

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

const verifySignature = (headers: Record<string, string | undefined>, method: string,
                         target: string, rawBody: string, secret: string): boolean => {
  const timestamp = Number(headers["x-elasticemail-timestamp"]);
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}\n${method}\n${target}\n${rawBody}`).digest("hex"));

  return (headers["x-elasticemail-signature"] ?? "").split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .some((part) => {
      const received = Buffer.from(part.slice(3));
      return received.length === expected.length && timingSafeEqual(received, expected);
    });
};
```

Rules:

1. Read the raw body before parsing it. Parsing and re-serializing changes the bytes.
2. Reject timestamps more than 5 minutes away from your clock. Every retry is signed again with a
   fresh timestamp, so retried events still pass.
3. Compare in constant time, return 401 on a mismatch. Elastic Email retries for up to 24 hours, so
   nothing is lost while you fix a wrong secret.
4. Signed and `POST` webhooks don't follow redirects: register the final URL.

Test vectors (secret `whsec_test_secret`, timestamp `1790000000`):

| Method | Target | Body | Signature |
|---|---|---|---|
| `POST` | `/webhook?v=2` | `{"status":"Sent","to":"ann@example.com"}` | `9e2169fcd0a96f634795bb9eac9c985574a7dcf9741b4c863cb4a75bdea3b465` |
| `GET` | `/webhook?status=Sent&to=ann%40example.com` | (empty) | `e1d554a00233bcf7b00d296348cd3f4390fdd578fe606789b3067b0487442b52` |

## Protecting an unsigned webhook

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
and not in a shared log or a screenshot. To move an unsigned webhook to signing, create a new signed
webhook on a different URL (for example `/webhook?v=2`), deploy verification, then delete the old one.

## Rotating the secret

`POST /webhook/{id}/secret/rotate` returns a new `SigningSecret`. There is no grace period: within
about a minute only the new secret is used. Update `ELASTICEMAIL_WEBHOOK_SECRET` straight away; events
your endpoint rejects in the meantime are retried and signed with the new secret.

## The test event on save

**Creating a webhook (or changing its URL) sends a test event**, using the webhook's method and
signing. The webhook is kept only if the response is accepted:

- unsigned webhook: a 2xx;
- signed webhook, **created**: a 2xx, 401 or 403 - your endpoint can't know the brand-new secret yet;
- signed webhook, **URL changed**: a 2xx only.

The test event carries sample values (`to=test@test.com`, `messageid=abc1234`, `status=opened` in
lowercase). The handlers in this repository accept it and log it. In your own app, skip it before it
reaches your database.

## What arrives

| Field | Meaning |
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

A `Get` webhook sends these as query parameters. A `PostJson` webhook sends the same names in a flat
JSON object (`Content-Type: application/json`); there, `to`, `from`, `channel`, `subject` and
`messageid` are `null` when empty, and any query string you put in the webhook URL is kept as is.

All field names are lowercase. Values are case-sensitive where they matter: a real event has
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
- **Never log raw event values.** They are attacker-controlled, even on a signed webhook: the
  signature proves who sent the request, not that `to` or `target` are safe. The examples strip `\r`
  and `\n` with `sanitize()` before anything reaches a log line.
- **Do not assume ordering.** `Opened` can arrive before `Sent` finishes processing on your side.

## Local development

Elastic Email has to reach the URL, so `localhost` will not do:

```bash
ngrok http 3000
# set PUBLIC_URL to the https URL ngrok prints, restart the app, then create the webhook
```

Simulate an event against an unsigned handler (`ELASTICEMAIL_WEBHOOK_SECRET` empty):

```bash
curl "http://localhost:3000/webhook?token=change_me&status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

Simulate a signed `POST` (with `ELASTICEMAIL_WEBHOOK_SECRET=whsec_test_secret`):

```bash
BODY='{"status":"Sent","to":"you@yourdomain.com","transaction":"abc","messageid":"xyz"}'
TS=$(date +%s)
SIG=$(printf '%s\n%s\n%s\n%s' "$TS" POST /webhook "$BODY" | openssl dgst -sha256 -hmac whsec_test_secret -hex | sed 's/^.* //')
curl -X POST http://localhost:3000/webhook -H 'Content-Type: application/json' \
  -H "X-ElasticEmail-Timestamp: $TS" -H "X-ElasticEmail-Signature: v1=$SIG" -d "$BODY"
```

## Framework-specific traps

| Stack | Trap |
|---|---|
| All | Signature verification needs the **raw** body and the **raw** path + query. Global JSON body parsers and URL rewriting break it; the examples keep the raw body for the webhook route. |
| SvelteKit | The built-in CSRF check rejects form posts without an `Origin` header before the handler runs. Inbound email arrives as exactly that kind of post. `kit.csrf.checkOrigin` is set to `false` in `svelte.config.js` for this reason. |
| Express | `express.json()` keeps a copy of the raw body for signature checks. `express.urlencoded()` is mounted for inbound email, with its limit raised to `25mb`. |
| Fastify | Does not parse form bodies by default. The examples register `@fastify/formbody` and raise `bodyLimit` to 25 MB for inbound mail, and keep the raw JSON body for the webhook route. |
| NestJS | POST handlers answer 201 by default; the controllers set `@HttpCode(200)`. The app is created with `rawBody: true` so the guard can verify signatures. |
| Node.js (`node:http`) | There is no body parser. The example reads the stream (capped at 25 MB) and verifies against those bytes. For `Get` webhooks it merges the query string into the event. |
| Supabase Edge Functions | Set `verify_jwt = false` for the webhook function - Elastic Email sends no JWT. |
| RedwoodJS | Functions receive an API Gateway style event; form bodies are parsed with `URLSearchParams`. |
| Next.js, Remix, Astro, Nuxt, TanStack | Read the body with `await request.text()` before parsing. For unsigned `Get` webhooks, a route that only exports `POST` answers 405 and saving the webhook fails, so the handlers export both GET and POST. |

## In this repository

- `webhooks` in every stack creates a signed `PostJson` webhook, prints its secret, lists webhooks,
  rotates the secret and deletes the webhook.
- The server apps expose `GET|POST /webhook` with signature verification (or the `?token=` fallback)
  and the full event switch.
- `double-optin-webhook` shows a handler that acts on one specific event type.
