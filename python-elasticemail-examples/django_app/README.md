# Django Email Example - Elastic Email API

A minimal Django project that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API and receives its webhooks, using the official Elastic Email Python SDK.

> Part of the [Python email API examples](../README.md). For the concepts behind it, see the [Elastic Email guides](../../docs/README.md).

## Setup

```bash
cd django_app

# Install dependencies (from parent directory)
pip install -r ../requirements.txt

# Set environment variables in ../.env

# Run the server
python manage.py runserver 8001
```

## Endpoints

- `GET /health` - Health check
- `POST /send` - Send a transactional email
- `GET|POST /webhook?token=...` - Elastic Email event notifications
- `POST /inbound?token=...` - Inbound email pushed by an inbound route
- `POST /double-optin/subscribe` - Store contact and send confirmation email
- `GET /double-optin/confirm?email=&token=` - Add the contact to the list
- `POST /double-optin/webhook?token=...` - Confirm subscription on a Clicked event

## Test

```bash
curl -X POST http://localhost:8001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Django!"}'
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email API reference](https://elasticemail.com/developers/api-documentation/rest-api) - every endpoint and parameter
- [Python email API examples](../README.md) - the same features as standalone scripts
- [Elastic Email guides](../../docs/README.md) - sending, templates, webhooks, inbound, deliverability
