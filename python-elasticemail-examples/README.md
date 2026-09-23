# Python Email API Examples - Elastic Email

Send transactional and bulk email from Python with the [Elastic Email](https://elasticemail.com/email-api) email API. Standalone scripts plus three web applications - Flask, FastAPI and Django - built on the official Elastic Email Python SDK.

> **First time here?** The [Python quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Python 3.9+
- pip
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

```bash
# Create virtual environment (optional)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

## Standalone Examples

Run every script from this folder.

### Basic Email Sending
```bash
python examples/basic_send.py
```

### Batch Sending
```bash
python examples/batch_send.py
```

### With Attachments
```bash
python examples/with_attachments.py
```

### With CID (Inline) Attachments
```bash
python examples/with_cid_attachments.py
```

### Using Templates
```bash
python examples/with_template.py
```

### Scheduled Sending
```bash
python examples/scheduled_send.py
```

### Prevent Gmail Threading
```bash
python examples/prevent_threading.py
```

### Contacts and Lists
```bash
python examples/contacts.py
```

### Domain Management
```bash
python examples/domains.py
```

### Email Status
```bash
python examples/email_status.py <transactionId> [messageId]
```

### Webhooks
```bash
python examples/webhooks.py
```

### Inbound Routes
```bash
python examples/inbound.py
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
python examples/double_optin_subscribe.py user@example.com "John Doe"

# Click-tracking based confirmation server
python examples/double_optin_webhook.py
```

### Suppressions
```bash
python examples/suppressions.py [email]
```

### Email Verification
```bash
python examples/email_verification.py someone@example.com
```

### Statistics
```bash
python examples/statistics.py
```

### Sub-Accounts
```bash
python examples/sub_accounts.py
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true python examples/sub_accounts.py
```

## Flask Application

```bash
python examples/flask_app.py

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Flask!"}'
```

## FastAPI Application

```bash
python examples/fastapi_app.py
# or: uvicorn examples.fastapi_app:app --reload --port 3000

curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from FastAPI!"}'
```

## Django Application

```bash
cd django_app
python manage.py runserver 8001

curl -X POST http://localhost:8001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Django!"}'
```

## API Endpoints

All three server apps expose the same routes and JSON shapes.

- `GET /health` -> `{"status": "ok"}`
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`
- `GET|POST /webhook?token=...` - Elastic Email event notifications. Parameters arrive in the query string or as form fields (`status`, `to`, `transaction`, `messageid`, `target`, ...). The `token` must match `ELASTICEMAIL_WEBHOOK_TOKEN`.
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

## Quick Usage

```python
import ElasticEmail

configuration = ElasticEmail.Configuration()
configuration.api_key["apikey"] = "your_api_key"

with ElasticEmail.ApiClient(configuration) as api_client:
    emails_api = ElasticEmail.EmailsApi(api_client)
    result = emails_api.emails_transactional_post(
        ElasticEmail.EmailTransactionalMessageData(
            Recipients=ElasticEmail.TransactionalRecipient(To=["you@yourdomain.com"]),
            Content=ElasticEmail.EmailContent(
                From="Acme <hello@yourdomain.com>",
                Subject="Hello",
                Body=[ElasticEmail.BodyPart(ContentType="HTML", Content="<p>Hello World</p>")],
            ),
        )
    )
    print(result.transaction_id, result.message_id)
```

## Project Structure

```
python-elasticemail-examples/
├── examples/
│   ├── ee.py                     # Shared config (API key, env values)
│   ├── basic_send.py             # Simple transactional email
│   ├── batch_send.py             # Bulk send with merge fields
│   ├── with_attachments.py       # Emails with files
│   ├── with_cid_attachments.py   # Inline images
│   ├── with_template.py          # Templates with merge values
│   ├── scheduled_send.py         # Delayed delivery (TimeOffset)
│   ├── prevent_threading.py      # Prevent Gmail threading
│   ├── contacts.py               # Contacts and lists
│   ├── domains.py                # Domain verification
│   ├── email_status.py           # Delivery status by transaction id
│   ├── webhooks.py               # Manage webhooks
│   ├── inbound.py                # Manage inbound routes
│   ├── double_optin_subscribe.py # Double opt-in: subscribe
│   ├── double_optin_webhook.py   # Double opt-in: click-based confirm server
│   ├── suppressions.py           # Unsubscribes, bounces, complaints
│   ├── email_verification.py     # Verify an address
│   ├── statistics.py             # Account statistics
│   ├── sub_accounts.py           # Sub-accounts (read-only by default)
│   ├── flask_app.py              # Flask web application
│   └── fastapi_app.py            # FastAPI web application
├── django_app/                   # Django web application
│   ├── manage.py
│   ├── django_project/
│   └── elasticemail_app/
├── requirements.txt
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email Python SDK](https://github.com/ElasticEmail/elasticemail-python)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
