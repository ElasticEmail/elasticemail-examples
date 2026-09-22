# Double opt-in

Double opt-in means nobody joins a list until they click a link in an email sent to that address. It
keeps bots and typos off your list, and it is the evidence you want when a complaint arrives.

The examples implement two flows. Both end with the contact on `ELASTICEMAIL_LIST_NAME`.

## Flow A - signed confirm link (default)

Three steps, no dependency on click tracking.

```
POST /double-optin/subscribe  { email, name }
      |
      |  1. contactsPost([{ Email, Status: "Transactional" }])
      |  2. send confirmation with a link carrying HMAC-SHA256(secret, email)
      v
GET  /double-optin/confirm?email=...&token=...
      |
      |  3. recompute the HMAC, compare, then listsByNameContactsPost(listName, { Emails: [email] })
      v
   redirect to CONFIRM_REDIRECT_URL, or JSON
```

The token is a hex HMAC of the email address keyed with `ELASTICEMAIL_WEBHOOK_TOKEN`:

```typescript
const confirmToken = createHmac("sha256", secret).update(email).digest("hex");
const confirmUrl = `${publicUrl}/double-optin/confirm?email=${encodeURIComponent(email)}&token=${confirmToken}`;
```

Nothing is stored between the two requests. The link is self-validating, which is why this flow works
in a stateless function as happily as in a long-running server.

What it does not do: expire. The HMAC has no timestamp, so a link stays valid until you rotate
`ELASTICEMAIL_WEBHOOK_TOKEN`. For production, sign `email + "|" + expiryTimestamp`, put the expiry in
the URL, and reject it once past.

## Flow B - confirm on the Clicked event

Same confirmation email, but no confirm endpoint of your own. Elastic Email's click tracking reports
the click, and the webhook handler completes the subscription.

```typescript
app.post("/double-optin/webhook", async (req, res) => {
  if (!tokenOk(req.query.token)) return res.status(401).json({ error: "Invalid token" });

  const event = { ...req.query, ...req.body };
  if (event.status !== "Clicked" || !String(event.target).includes("/double-optin/confirm")) {
    return res.json({ received: true, message: "Event ignored" });
  }

  await listsApi.listsByNameContactsPost(listName, { Emails: [event.to] });
  res.json({ received: true, confirmed: true });
});
```

The `target` parameter carries the clicked URL, which is how the handler tells the confirm link apart
from any other link in the message.

## Picking one

| | Flow A (signed link) | Flow B (Clicked event) |
|---|---|---|
| Needs a public endpoint | yes, for the confirm link | yes, for the webhook |
| Needs click tracking enabled | no | yes |
| Confirms on link preview / scanner | only if it follows the link | same risk, plus every scanner click counts |
| Works with the confirm link off-domain | yes | yes |
| Visible feedback to the person | immediate page or redirect | none, unless the link also lands somewhere useful |

Flow A is the default in every stack because it gives the subscriber a page and does not depend on an
account setting. Flow B is useful when the confirmation email is sent by a system you do not control.

Both share the same weakness: corporate mail scanners click links before the human sees them. If
false confirmations matter, put a button and a `POST` behind the link rather than confirming on `GET`.

## Security notes taken from the code

- The token comparison is constant-time everywhere (`timingSafeEqual` in Node, `hash_equals` in PHP,
  `Plug.Crypto.secure_compare` in Elixir, `subtle::ConstantTimeEq` in Rust). A naive `==` leaks
  timing information one byte at a time.
- Values coming from the request are stripped of `\r` and `\n` before they reach a log line
  (`sanitize()` in the examples). Without that, anything logged is forgeable.
- `ELASTICEMAIL_WEBHOOK_TOKEN` is both the URL secret and the HMAC key. Rotating it invalidates every
  confirm link already in flight.

## Running it locally

```bash
# terminal 1 - the app
npm run dev

# terminal 2 - a public URL, then set PUBLIC_URL to it and restart
ngrok http 3000

# terminal 3
curl -X POST http://localhost:3000/double-optin/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"you@yourdomain.com","name":"Ann"}'
```

The standalone scripts do the same without a server:
`npx tsx examples/double-optin-subscribe.ts user@example.com "John Doe"` prints the confirm URL it
generated, so you can open it directly.
