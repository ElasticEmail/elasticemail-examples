# Spring Boot Email Example - Elastic Email API

A minimal Spring Boot application that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API and receives its webhooks, using the official Elastic Email Java SDK.

> Part of the [Java email API examples](../README.md). For the concepts behind it, see the [Elastic Email guides](../../docs/README.md).

## Setup

```bash
cd spring_boot_app

# Set environment variables (Spring reads them from the OS environment)
export ELASTICEMAIL_API_KEY=your_api_key
export EMAIL_FROM="Acme <hello@yourdomain.com>"
export CONTACT_EMAIL=team@yourdomain.com
export ELASTICEMAIL_WEBHOOK_TOKEN=change_me
export ELASTICEMAIL_LIST_NAME=Newsletter
export PUBLIC_URL=http://localhost:3000

# Build and run
mvn spring-boot:run
```

## Endpoints

- `GET /health` - health check
- `POST /send` body `{"to", "subject", "message"}` - transactional send
- `GET|POST /webhook?token=...` - Elastic Email event notifications
- `POST /inbound?token=...` - inbound email pushed by an inbound route, forwarded to `CONTACT_EMAIL`
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact and sends a confirmation link
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to the list
- `POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

## Test

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Spring Boot!"}'
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email API reference](https://elasticemail.com/developers/api-documentation/rest-api) - every endpoint and parameter
- [Java email API examples](../README.md) - the same features as standalone scripts
- [Elastic Email guides](../../docs/README.md) - sending, templates, webhooks, inbound, deliverability
