# Domains and deliverability

The `From` address must belong to a domain verified on your account. An unverified sender is rejected
by the API at send time - you get a 4xx immediately, not a bounce an hour later.

## Adding a domain and reading its state

```typescript
await domainsApi.domainsPost({ Domain: "yourdomain.com" });   // 400 "already exists" is fine

const { data } = await domainsApi.domainsByDomainGet("yourdomain.com");
// data.Spf, data.Dkim, data.MX, data.DMARC, data.TrackingStatus, data.DefaultDomain, data.DKIMRecord
```

`data.DKIMRecord` contains the record to publish. `domainsGet()` lists every domain with its flags.

## The DNS records

| Record | What it does | Skippable? |
|---|---|---|
| SPF | Authorizes Elastic Email's servers to send for the domain | No |
| DKIM | Cryptographically signs your mail | No |
| DMARC | Tells receivers what to do when SPF and DKIM fail, and where to send reports | Technically yes, increasingly not in practice |
| MX | Required only for [inbound email](inbound-email.md) | Yes, unless you receive |
| Tracking CNAME | Serves open and click tracking from your own domain instead of a shared one | Yes, but shared tracking domains carry other senders' reputation |

Gmail and Yahoo require SPF, DKIM and DMARC from bulk senders. "Bulk" is lower than most people
assume. Publish all three.

DNS propagation is minutes to hours. The flags flip to true on their own; re-run the domains example
to check rather than re-adding the domain.

## Verifying tracking and setting the default sender

```typescript
await domainsApi.domainsByDomainVerificationPut("yourdomain.com", "Http");  // tracking CNAME
await domainsApi.domainsByEmailDefaultPatch("hello@yourdomain.com");        // account default sender
```

Both are commented out in the examples so a run cannot change account-wide settings by accident.

## Subdomain strategy

Reputation is tracked per domain and per subdomain. Splitting streams keeps a marketing campaign from
taking receipts down with it:

| Subdomain | Traffic |
|---|---|
| `mail.yourdomain.com` | Transactional: receipts, password resets, alerts |
| `news.yourdomain.com` | Marketing: campaigns, newsletters |
| `reply.yourdomain.com` | Inbound, with the MX record pointed at Elastic Email |

The apex domain keeps its own MX for your normal company mail.

## Warming up

A brand new domain sending 50,000 messages on day one looks exactly like a compromised account.
Start with hundreds a day to your most engaged recipients and grow the volume over one to two weeks.
Bounces and complaints during this window cost far more than they will later.

## Content-level things that decide whether mail lands

- Send a `PlainText` part alongside the HTML. A body with no text alternative is a spam signal.
- Keep the `From` address stable. Rotating sender addresses resets recognition every time.
- Make unsubscribe easy and one click. Lists created by the examples set `AllowUnsubscribe: true`.
- Remove people who have not opened anything in six months. Inactive recipients drag engagement rates
  down, and engagement is what receivers score you on.
- Watch complaints. Above roughly 0.1% is trouble; above 0.3% is a blocklist.

Check the numbers with [statistics](account.md), and react to them with [webhooks](webhooks.md).

## In this repository

`domains` in every stack adds `SENDING_DOMAIN`, prints the verification state with the DKIM record to
publish, and lists every domain on the account. Laravel additionally exposes
`POST /api/domains/{domain}/verify-tracking` and `POST /api/domains/{domain}/default`.
