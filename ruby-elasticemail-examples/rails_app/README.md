# Rails Email Example - Elastic Email API

A minimal Rails API application (API-only mode, no database) that sends email through the [Elastic Email](https://elasticemail.com/email-api) email API and receives its webhooks, inbound email and double opt-in confirmations.

> Part of the [Ruby email API examples](../README.md). For the concepts behind it, see the [Elastic Email guides](../../docs/README.md).

## Setup

```bash
cd rails_app
bundle install
```

The app reads `.env` from the parent folder (`ruby-elasticemail-examples/.env`), so one `.env`
serves both the standalone examples and this app.

## Running

```bash
# From the rails_app directory
bundle exec rails server -p 3000
```

## Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### Send Email
```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Rails!"}'
```

Response: `{"success": true, "transactionId": "...", "messageId": "..."}`

### Webhook Handler
```
GET|POST http://localhost:3000/webhook?token=<ELASTICEMAIL_WEBHOOK_TOKEN>
```

Elastic Email posts event parameters as form fields (`status`, `to`, `transaction`, `messageid`,
`target`, ...) and sends a GET to validate the URL when the webhook is saved. Requests without the
right `token` get 401.

### Inbound Email
```
POST http://localhost:3000/inbound?token=<ELASTICEMAIL_WEBHOOK_TOKEN>
```

Receives the parsed message from an inbound route (`from_email`, `subject`, `body_html`,
`att1_name`, `att1_content`, ...) and forwards a copy to `CONTACT_EMAIL`.

### Double Opt-In
```bash
curl -X POST http://localhost:3000/double-optin/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "you@yourdomain.com", "name": "John Doe"}'
```

The confirmation link points at `GET /double-optin/confirm?email=&token=` where `token` is
`HMAC_SHA256(ELASTICEMAIL_WEBHOOK_TOKEN, email)`. On success the contact is added to
`ELASTICEMAIL_LIST_NAME` and the response is JSON, or a redirect when `CONFIRM_REDIRECT_URL` is set.

`POST /double-optin/webhook?token=...` is the click-tracking variant: a `Clicked` event whose
`target` contains `/double-optin/confirm` adds the recipient to the list.

## Environment Variables

- `ELASTICEMAIL_API_KEY` - API key (required)
- `EMAIL_FROM` - verified sender, defaults to `Acme <hello@yourdomain.com>`
- `CONTACT_EMAIL` - where inbound email is forwarded
- `ELASTICEMAIL_WEBHOOK_TOKEN` - shared secret checked on webhook and inbound requests
- `ELASTICEMAIL_LIST_NAME` - contact list used by double opt-in
- `PUBLIC_URL` - public base URL used to build confirm links
- `CONFIRM_REDIRECT_URL` - optional redirect after confirmation

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email API reference](https://elasticemail.com/developers/api-documentation/rest-api) - every endpoint and parameter
- [Ruby email API examples](../README.md) - the same features as standalone scripts
- [Elastic Email guides](../../docs/README.md) - sending, templates, webhooks, inbound, deliverability
