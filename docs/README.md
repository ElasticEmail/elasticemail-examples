# Elastic Email API Guides - Concepts Behind the Examples

Language-neutral guides to the [Elastic Email](https://elasticemail.com/email-api) email API:
the request shapes, the parameters that matter and the mistakes that cost the most time. They
explain what every example in this repository is doing, whichever language you picked.

Each stack folder has its own `QUICKSTART.md` (five minutes to a first send) and `README.md`
(every example, every route). These guides sit underneath both - start from the
[stack list](../README.md) if you have not sent an email yet.

## Start here

| Guide | What it covers |
|---|---|
| [Environment variables](environment-variables.md) | Every variable the examples read, where it is used and what breaks without it |
| [Sending email](sending-email.md) | Transactional vs bulk, merge fields, scheduling, threading, checking delivery |
| [Attachments](attachments.md) | File attachments and inline (CID) images |
| [Templates](templates.md) | Hosted templates, merge values, creating a template from code |
| [Contacts and lists](contacts-and-lists.md) | Lists, contact CRUD, statuses, custom fields |
| [Double opt-in](double-opt-in.md) | Both confirmation flows the examples implement, and when to pick which |
| [Webhooks](webhooks.md) | Event notifications, the parameters they carry, and the token scheme |
| [Inbound email](inbound-email.md) | Inbound routes, MX setup, the parsed fields you receive |
| [Suppressions](suppressions.md) | Unsubscribes, bounces, complaints |
| [Domains and deliverability](domains-and-deliverability.md) | SPF, DKIM, MX, DMARC, tracking CNAME |
| [Account](account.md) | Statistics, email verification, sub-accounts |
| [Error handling](error-handling.md) | The error body, and how each SDK surfaces it |
| [API map](api-map.md) | One table: use case to SDK method, in every language in this repository |
| [Troubleshooting](troubleshooting.md) | Symptom to cause, for the failures that actually happen |

## The one-paragraph version

Elastic Email's REST API v4 lives at `https://api.elasticemail.com/v4`. Authentication is the
`X-ElasticEmail-ApiKey` header, which every SDK sets for you once you hand it the key. Sending is
`POST /emails/transactional` (one message, personal recipients) or `POST /emails` (one bulk job,
per-recipient merge fields). Both return a `TransactionID` and a `MessageID` you can look up later.
The `From` address must belong to a domain you have verified. Failures come back as
`{"Error": "message"}` with a 4xx or 5xx status.

## Conventions used across every stack

- The examples take configuration from environment variables only. No key is ever hardcoded.
- Server apps expose the same routes with the same JSON shapes, whatever the language:
  `POST /send` takes `{ to, subject, message }` and answers `{ success, transactionId, messageId }`.
- Failures answer `{ "error": "<message from the API>" }` with the status the API returned.
- Webhook and inbound endpoints carry a shared secret in the query string (`?token=...`) and compare
  it in constant time. Elastic Email does not sign its callbacks, so this is the only check available.
- Sends set both an HTML and a plain text body part where it makes sense. Some mail clients and most
  spam filters expect both.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email API reference](https://elasticemail.com/developers/api-documentation/rest-api) - every endpoint and parameter
- [Elastic Email SDKs](https://elasticemail.com/developers/api-libraries) - official client libraries
- [All example stacks](../README.md) - 20 languages, frameworks and serverless platforms
