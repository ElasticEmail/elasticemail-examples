# Sending email

Two endpoints do all the sending. Everything else - attachments, templates, scheduling, custom
headers - is a field inside one of them.

| Endpoint | SDK method (TypeScript) | Use it for |
|---|---|---|
| `POST /emails/transactional` | `emailsApi.emailsTransactionalPost(...)` | One message to one set of recipients. Each recipient sees the To/CC list. Up to 50 recipients per call. |
| `POST /emails` | `emailsApi.emailsPost(...)` | One bulk job, one personalized copy per recipient. Recipients never see each other. Up to 1000 recipients per call. |

Both answer with `{ TransactionID, MessageID }`. Keep the transaction id: it is how you look up
delivery later, and bulk sends return only that one id for the whole job.

## Transactional send

```typescript
const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Hello from Elastic Email!",
    Body: [
      { ContentType: "HTML", Content: "<h1>Welcome!</h1><p>Thanks for signing up.</p>" },
      { ContentType: "PlainText", Content: "Welcome! Thanks for signing up." },
    ],
  },
});
```

`Body` is an array of parts. Send both `HTML` and `PlainText` where you can: some clients render the
text part, and a message with no text alternative scores worse with spam filters.

### The Content object

| Field | Type | Notes |
|---|---|---|
| `From` | string | `Name <address>` or a bare address. The domain must be verified. |
| `ReplyTo` | string | Where replies go, when that differs from `From`. The inbound forwarder uses this to keep replies flowing to the original sender. |
| `Subject` | string | Ignored when `TemplateName` is set and the template defines its own subject. |
| `Body` | array | `{ ContentType: "HTML" \| "PlainText", Content: "..." }`. |
| `Attachments` | array | See [Attachments](attachments.md). |
| `Headers` | object | Arbitrary headers, for example `X-Entity-Ref-ID`. |
| `TemplateName` | string | Send a stored template instead of an inline body. See [Templates](templates.md). |
| `Merge` | object | Values substituted into `{placeholders}` in the template or inline body. |
| `Postback` | string | Value echoed back on webhook events for this message. |

### Recipients

- Transactional: `Recipients: { To: [...], CC: [...], BCC: [...] }`.
- Bulk: `Recipients: [{ Email, Fields }, ...]` - a flat array, one entry per person.

## Bulk send with merge fields

One call, one personalized email each. `Fields` values replace `{placeholders}` anywhere in the
subject or body.

```typescript
const recipients = [
  { Email: "ann@example.com", Fields: { firstname: "Ann", plan: "Pro" } },
  { Email: "ben@example.com", Fields: { firstname: "Ben", plan: "Starter" } },
];

const { data } = await emailsApi.emailsPost({
  Recipients: recipients,
  Content: {
    From: from,
    Subject: "Hi {firstname}, your {plan} plan is ready",
    Body: [
      { ContentType: "HTML", Content: "<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>" },
      { ContentType: "PlainText", Content: "Hi {firstname}! Your {plan} plan is now active." },
    ],
  },
});
```

Placeholders are single braces, not double. A placeholder with no matching field is left in the
message as literal text, so proofread the field names.

## Retrying safely: Idempotency-Key

A send that times out may still have gone through, and a plain retry can then deliver the same email
twice. Send an `Idempotency-Key` header and you can retry without that risk: if Elastic Email
already processed the key, it returns the first response instead of sending again. The header
works on `POST /emails/transactional`, `POST /emails` and `POST /emails/mergefile`, and it is
optional. Sends without it behave as before.

```typescript
import { randomUUID } from "node:crypto";

// One key per logical send. Reuse it only to retry this same send.
const idempotencyKey = randomUUID();

// After a timeout, a network error, a 409 or a 503, call this again with the same message and key.
const { data, headers } = await emailsApi.emailsTransactionalPost(message, idempotencyKey);
const replayed = headers["idempotency-replayed"] === "true"; // an earlier attempt already sent it
```

In the TypeScript SDK (4.4.0+) the key is the optional second argument of `emailsTransactionalPost`,
`emailsPost` and `emailsMergefilePost`. Other languages: [API map](api-map.md#idempotency-key).

| You send | You get |
|---|---|
| A new key | A normal send. The response is stored under the key for 24 hours. |
| The same key, same endpoint, byte-identical body, within 24 hours | The stored response (same status, same `TransactionID` and `MessageID`) with an `Idempotency-Replayed: true` header. Nothing is sent or charged again. |
| The same key with a different body or endpoint | `422` `Idempotency-Key was already used with a different request` |
| The same key while the first request is still running | `409` `Request with this Idempotency-Key is in progress`. Retry a moment later. |
| A key that is empty, longer than 255 characters or not printable ASCII | `400` |
| A key Elastic Email can't confirm right now | `503` with `Retry-After` (seconds). Nothing was sent: wait that long and retry with the same key. |
| The same key after the first request failed with a 4xx or 5xx | The key was released, so a corrected retry with the same key runs normally. |

Rules of thumb:

- **One key per logical send**, created before the first attempt (a UUID v4 is the usual choice)
  and reused only for that send's retries. Never derive it from the attempt number.
- **Retry with the exact same body.** Build the message once, or deterministically from the same
  input. A timestamp or random value inside the body turns the retry into a `422`.
- **Keys are scoped per account.** Sub-accounts have their own keys.
- **In a background job**, use something that stays the same across the job's attempts: the job
  id, event id or run id. See the [queue examples](../queues-elasticemail-examples/README.md).
- **In a server that sends on behalf of its own clients**, accept an `Idempotency-Key` header from
  the client and pass it through. Every `POST /send` route in this repository does that, and
  generates a new key when the client sends none.

## Scheduling

`Options.TimeOffset` delays delivery by N minutes from now. Maximum 50400 minutes (35 days).

```typescript
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: { From: from, Subject: "Scheduled", Body: [{ ContentType: "HTML", Content: "<p>Later.</p>" }] },
  Options: { TimeOffset: 60 },
});
```

There is no cancel endpoint for a single delayed message. Pick the offset deliberately, and prefer
your own job queue when you need the ability to change your mind.

## Preventing Gmail threading

Gmail groups messages with the same subject into one conversation. Receipts, alerts and order
confirmations disappear into a collapsed thread that way. A unique `X-Entity-Ref-ID` header per
message stops the grouping:

```typescript
Headers: { "X-Entity-Ref-ID": randomUUID() }
```

The examples send three messages with an identical subject and different ref ids so you can see the
effect in a real inbox.

## Checking what happened

Every send returns two ids:

- `TransactionID` - the job. One per API call, shared by every recipient of a bulk send.
- `MessageID` - the individual message.

```typescript
const { data } = await emailsApi.emailsByTransactionidStatusGet(
  transactionId,
  true, // showFailed
  true, // showSent
  true, // showDelivered
  true, // showPending
  true, // showOpened
  true, // showClicked
);
// data.Status, data.RecipientsCount, data.DeliveredCount, data.FailedCount, data.Failed[...]
```

`emailsApi.emailsByMsgidViewGet(messageId)` returns the rendered message itself - `Preview.From`,
`Preview.Subject`, `Preview.Body` and `Status.StatusName` - which is the fastest way to confirm that
merge values and inline images came out the way you expected.

Polling status is for debugging. For production, subscribe to [webhooks](webhooks.md).

## Limits and sizing

| Thing | Limit |
|---|---|
| Recipients per transactional call | 50 |
| Recipients per bulk call | 1000 |
| `TimeOffset` | 50400 minutes (35 days) |
| Message size | account-dependent; attachments are base64, so they cost about a third more than the file on disk |

## In this repository

| Example | File (Express/TypeScript) | Equivalent elsewhere |
|---|---|---|
| Basic send | `examples/basic-send.ts` | `basic_send.*`, `BasicSend.*`, `src/send/basic.php` |
| Bulk send | `examples/batch-send.ts` | `batch_send.*`, `BatchSend.*`, `src/send/batch.php` |
| Scheduled | `examples/scheduled-send.ts` | `scheduled_send.*`, `ScheduledSend.*`, `src/scheduling/send.php` |
| Threading | `examples/prevent-threading.ts` | `prevent_threading.*`, `PreventThreading.*`, `src/send/prevent_threading.php` |
| Status lookup | `examples/email-status.ts` | `email_status.*`, `EmailStatus.*`, `src/send/status.php` |

See the [API map](api-map.md) for the method name in your language.
