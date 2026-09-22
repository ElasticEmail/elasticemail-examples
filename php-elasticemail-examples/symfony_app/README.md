# Symfony Email Example - Elastic Email API

A minimal Symfony app (MicroKernel, PHP routing config) that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API, calling the Elastic Email PHP SDK directly.

> Part of the [PHP email API examples](../README.md). For the concepts behind it, see the [Elastic Email guides](../../docs/README.md).

## Setup

```bash
cd symfony_app

# Install dependencies
composer install

# Environment variables are read from ../.env (shared with the standalone examples)
cp ../.env.example ../.env

# Run the server
php -S localhost:8081 -t public
```

## Endpoints

- `GET /health` - health check
- `POST /send` - `{ to, subject, message }` -> `{ success, transactionId, messageId }`
- `POST /send-prevent-threading` - same subject, unique `X-Entity-Ref-ID` header
- `POST /send-batch` - bulk send with merge fields (`{firstname}`)
- `POST /send-attachment` - text file attachment
- `POST /send-cid` - inline image referenced as `cid:logo.png`
- `POST /send-scheduled` - `{ to, subject, message, timeOffset }`, minutes from now
- `POST /send-template` - `{ to, templateName?, merge? }`, template created on first use
- `GET /domains` / `POST /domains` - list domains, add a domain (`{ domain }`)
- `GET /contacts?list=` / `POST /contacts` - list contacts on a list, add a contact (`{ email, firstName, lastName, list }`)
- `GET|POST /webhook?token=` - event notifications
- `POST /inbound?token=` - inbound email, forwarded to `CONTACT_EMAIL`
- `POST /double-optin/subscribe` - `{ email, name }`
- `GET /double-optin/confirm?email=&token=` - HMAC check, adds the contact to the list
- `POST /double-optin/webhook?token=` - confirm on a `Clicked` event

Failures return `{ "error": "<message from the API>" }` with the API status code.

## Test

```bash
curl -X POST http://localhost:8081/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Symfony!"}'
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email API reference](https://elasticemail.com/developers/api-documentation/rest-api) - every endpoint and parameter
- [PHP email API examples](../README.md) - the same features as standalone scripts
- [Elastic Email guides](../../docs/README.md) - sending, templates, webhooks, inbound, deliverability
