# Phoenix Email Example - Elastic Email API

A small Phoenix 1.7 API (Bandit adapter) that sends email through the [Elastic Email](https://elasticemail.com/email-api) email API and handles its webhooks and inbound routes, exposing the same routes as the Express example. It uses the `ElasticEmail` module from the parent folder as a path dependency.

> Part of the [Elixir email API examples](../README.md). For the concepts behind it, see the [Elastic Email guides](../../docs/README.md).

## Run

```bash
mix deps.get
mix phx.server
```

Reads `../.env` (or `./.env`). `PORT` defaults to 3000.

## Routes

- `GET /health`
- `POST /send` body `{"to", "subject", "message"}`
- `GET|POST /webhook` (signed, or `?token=...` for unsigned webhooks)
- `POST /inbound?token=...`
- `POST /double-optin/subscribe` body `{"email", "name"}`
- `GET /double-optin/confirm?email=&token=`
- `GET|POST /double-optin/webhook` (signed, or `?token=...` for unsigned webhooks)

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Phoenix!"}'

# Unsigned webhook (ELASTICEMAIL_WEBHOOK_SECRET empty)
curl "http://localhost:3000/webhook?token=change_me&status=Sent&to=you@yourdomain.com&transaction=abc"
```

Signed webhooks (recommended) are created with `"EnableSigning" => true` and
`"DeliveryMethod" => "PostJson"` (see `../examples/webhooks.exs`). Store the `SigningSecret`
returned once at creation as `ELASTICEMAIL_WEBHOOK_SECRET`; the webhook handlers then require a
valid `X-ElasticEmail-Signature` (HMAC-SHA256 over timestamp, method, request target and raw body,
at most 5 minutes old) and read the event from the JSON body. The endpoint's `Plug.Parsers` uses
`ElasticEmail.Webhook.read_body/2` as its body reader so the raw body is kept for the check.
The test event sent when the webhook is created arrives before you have the secret; Elastic
Email accepts the 401 for it.

Without the secret, webhook and inbound handlers compare `?token=` with
`ELASTICEMAIL_WEBHOOK_TOKEN` using `Plug.Crypto.secure_compare/2`. Confirm links carry
`HMAC-SHA256(token, email)` in hex.

## Files

```
phoenix_app/
├── config/
│   ├── config.exs
│   └── runtime.exs
├── lib/
│   ├── phoenix_app/application.ex
│   └── phoenix_app_web/
│       ├── endpoint.ex
│       ├── router.ex
│       ├── error_json.ex
│       ├── helpers.ex
│       └── controllers/
│           ├── health_controller.ex
│           ├── email_controller.ex
│           ├── webhook_controller.ex
│           ├── inbound_controller.ex
│           └── double_optin_controller.ex
└── mix.exs
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email API reference](https://elasticemail.com/developers/api-documentation/rest-api) - every endpoint and parameter
- [Elixir email API examples](../README.md) - the same features as standalone scripts
- [Elastic Email guides](../../docs/README.md) - sending, templates, webhooks, inbound, deliverability
