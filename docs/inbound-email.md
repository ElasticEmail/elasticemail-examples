# Inbound email

An inbound route tells Elastic Email what to do with mail arriving at your domain. The examples use
`NotifyViaHttp`: the message is parsed and POSTed to your endpoint as form fields.

## Prerequisite: MX record

The domain's MX record must point at Elastic Email:

```
yourdomain.com.   MX   10   mx.inbound.elasticemail.com.
```

Until that resolves, nothing arrives. This also means the domain can no longer deliver to your own
mailbox provider, so use a subdomain (`reply.yourdomain.com`, `inbound.yourdomain.com`) unless you
really intend to take over the whole domain's mail.

## Creating a route

```typescript
const { data } = await inboundApi.inboundroutePost({
  Name: "examples-inbound",
  Filter: `*@${domain}`,
  FilterType: "EmailAddress",
  ActionType: "NotifyViaHttp",
  HttpAddress: `${publicUrl}/inbound?token=${encodeURIComponent(token)}`,
});
// data.PublicId
```

| Field | Notes |
|---|---|
| `Filter` | Which addresses match. `*@domain.com` catches everything. |
| `FilterType` | `EmailAddress` for the pattern above. |
| `ActionType` | `NotifyViaHttp` posts to `HttpAddress`. Other actions forward or drop. |
| `HttpAddress` | Your endpoint, including the `?token=` shared secret. |
| `SortOrder` | Routes are evaluated in order; the first match wins. |

`inboundrouteGet()` lists routes, `inboundrouteByIdDelete(id)` removes one.

## What you receive

Form-encoded fields, not JSON:

| Field | Contents |
|---|---|
| `from_email`, `from_name` | Parsed `From` header |
| `env_from`, `env_to_list` | SMTP envelope sender and recipients |
| `to_list` | Parsed `To` header |
| `header_list` | Raw headers |
| `subject` | Subject line |
| `body_text` | Plain text body |
| `body_html` | HTML body, when the message had one |
| `att1_name`, `att1_content` | First attachment: file name and base64 content. Then `att2_*`, `att3_*`, and so on. |

The same `?token=` check as [webhooks](webhooks.md) guards the endpoint - inbound requests are
unsigned too.

## Forwarding to a human

The handler in every stack forwards the parsed message to `CONTACT_EMAIL`, keeping attachments and
setting `ReplyTo` to the original sender so a reply reaches them rather than your service address:

```typescript
const attachments = Object.keys(mail)
  .filter((k) => /^att\d+_name$/.test(k))
  .map((k) => ({ Name: mail[k], BinaryContent: mail[k.replace("_name", "_content")] }));

await emailsApi.emailsTransactionalPost({
  Recipients: { To: [contactEmail] },
  Content: {
    From: from,
    ReplyTo: mail.from_email,
    Subject: `Fwd: ${mail.subject ?? "(no subject)"}`,
    Body: [{ ContentType: "HTML", Content: mail.body_html || `<pre>${escapeHtml(mail.body_text ?? "")}</pre>` }],
    Attachments: attachments.filter((a) => a.BinaryContent),
  },
});
```

Note the escaping on the text fallback. `body_text` came from the internet; dropping it into HTML
unescaped is a straight injection into whatever reads the forwarded mail.

## Body size

Inbound messages with attachments are large. Express raises its urlencoded limit to `25mb` for this
reason; the equivalent setting exists in every framework and the default is usually far lower. A
truncated body with no error is almost always this.

## Local development

```bash
ngrok http 3000
# set PUBLIC_URL to the https URL, restart, then create the route
```

Simulate a delivery without sending real mail:

```bash
curl -X POST "http://localhost:3000/inbound?token=change_me" \
  --data-urlencode "from_email=sender@example.com" \
  --data-urlencode "subject=Test inbound" \
  --data-urlencode "body_text=Hello from a fake inbound message" \
  --data-urlencode "att1_name=note.txt" \
  --data-urlencode "att1_content=SGVsbG8gd29ybGQ="
```

## Things worth guarding against

- **Loops.** Forwarding inbound mail to an address handled by the same route mails yourself forever.
  Keep `CONTACT_EMAIL` outside the inbound domain.
- **Auto-replies.** Out-of-office messages arriving at a catch-all route can ping-pong. Drop messages
  carrying `Auto-Submitted` or `Precedence: bulk` headers.
- **Trust.** Anyone can send mail to your address. `from_email` is unverified; it is an input, not an
  identity.

## In this repository

- `inbound` in every stack creates, lists and deletes a route.
- The server apps expose `POST /inbound?token=...` with the forwarding handler.
- Laravel renders the forwarded copy through `resources/views/emails/inbound-forwarded.blade.php`.
