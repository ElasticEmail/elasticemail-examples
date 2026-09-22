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
- `GET|POST /webhook?token=...`
- `POST /inbound?token=...`
- `POST /double-optin/subscribe` body `{"email", "name"}`
- `GET /double-optin/confirm?email=&token=`
- `POST /double-optin/webhook?token=...`

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Phoenix!"}'

curl "http://localhost:3000/webhook?token=change_me&status=Sent&to=you@yourdomain.com&transaction=abc"
```

Webhook and inbound handlers compare `?token=` with `ELASTICEMAIL_WEBHOOK_TOKEN` using
`Plug.Crypto.secure_compare/2`. Confirm links carry `HMAC-SHA256(token, email)` in hex.

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
