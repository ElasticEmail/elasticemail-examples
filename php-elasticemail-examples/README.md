# PHP Email API Examples - Elastic Email

Send transactional and bulk email from PHP with the [Elastic Email](https://elasticemail.com/email-api) email API. Standalone scripts plus two web applications - Slim and Symfony - built on the official Elastic Email PHP SDK.

> **First time here?** The [PHP quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- PHP 8.1+
- Composer
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from https://app.elasticemail.com/marketing/settings/new/manage-api

## Installation

```bash
# Install dependencies
composer install

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

## Standalone Examples

Run every script from this folder. All scripts share `src/bootstrap.php`, which loads `.env` and builds the SDK configuration.

### Basic Email Sending
```bash
php src/send/basic.php
```

### Batch Sending
```bash
php src/send/batch.php
```

### Prevent Gmail Threading
```bash
php src/send/prevent_threading.php
```

### Email Status
```bash
php src/send/status.php <transactionId> [messageId]
```

### With Attachments
```bash
php src/attachments/send.php
```

### With CID (Inline) Attachments
```bash
php src/attachments/send_cid.php
```

### Using Templates
```bash
php src/templates/send.php
```

### Scheduled Sending
```bash
php src/scheduling/send.php
```

### Contacts and Lists
```bash
php src/contacts/manage.php
```

### Domain Management
```bash
php src/domains/manage.php
```

### Webhooks
```bash
# Create, list and delete a webhook pointing at PUBLIC_URL/webhook?token=...
php src/webhooks/manage.php

# Standalone handler (serve behind a public URL, e.g. ngrok)
php -S localhost:3000 src/webhooks/handler.php
```

### Inbound Routes
```bash
php src/inbound/manage.php

# Standalone handler for the inbound route
php -S localhost:3000 src/inbound/handler.php
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
php src/double-optin/subscribe.php user@example.com "John Doe"

# Confirm endpoint (HMAC link from the email)
php -S localhost:3000 src/double-optin/confirm.php

# Click-tracking based confirmation
php -S localhost:3000 src/double-optin/webhook.php
```

### Suppressions
```bash
php src/suppressions/manage.php [email]
```

### Email Verification
```bash
php src/verification/verify.php someone@example.com
```

### Statistics
```bash
php src/statistics/summary.php
```

### Sub-Accounts
```bash
php src/subaccounts/manage.php
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true php src/subaccounts/manage.php
```

## Slim Application

```bash
php -S localhost:8080 src/slim_app.php

# Then in another terminal:
curl -X POST http://localhost:8080/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from PHP!"}'
```

## Symfony Application

```bash
cd symfony_app
composer install
php -S localhost:8081 -t public

curl -X POST http://localhost:8081/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Symfony!"}'
```

See `symfony_app/README.md` for the extra routes it exposes.

## API Endpoints

Both server apps expose these routes with the same JSON shapes.

- `GET /health` -> `{"status": "ok"}`
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`
- `GET|POST /webhook?token=...` - Elastic Email event notifications. Parameters arrive in the query string or as form fields (`status`, `to`, `transaction`, `messageid`, `target`, ...). The `token` must match `ELASTICEMAIL_WEBHOOK_TOKEN`.
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

## Quick Usage

```php
<?php
require 'vendor/autoload.php';

$config = ElasticEmail\Configuration::getDefaultConfiguration()
    ->setApiKey('X-ElasticEmail-ApiKey', 'your_api_key');
$emailsApi = new ElasticEmail\Api\EmailsApi(new GuzzleHttp\Client(), $config);

$result = $emailsApi->emailsTransactionalPost(new ElasticEmail\Model\EmailTransactionalMessageData([
    'recipients' => new ElasticEmail\Model\TransactionalRecipient(['to' => ['you@yourdomain.com']]),
    'content' => new ElasticEmail\Model\EmailContent([
        'from' => 'Acme <hello@yourdomain.com>',
        'subject' => 'Hello',
        'body' => [new ElasticEmail\Model\BodyPart(['content_type' => 'HTML', 'content' => '<p>Hello World</p>'])],
    ]),
]));

echo $result->getTransactionId(), ' ', $result->getMessageId();
```

Model constructors take snake_case keys (`from`, `subject`, `content_type`, `binary_content`, `template_name`, `time_offset`). Errors are `ElasticEmail\ApiException` with `getCode()` and `getResponseBody()` (`{"Error": "..."}`).

## Project Structure

```
php-elasticemail-examples/
├── src/
│   ├── bootstrap.php             # .env loading, Configuration, helpers
│   ├── send/
│   │   ├── basic.php             # Simple transactional email
│   │   ├── batch.php             # Bulk send with merge fields
│   │   ├── prevent_threading.php # Prevent Gmail threading
│   │   └── status.php            # Delivery status by transaction id
│   ├── attachments/
│   │   ├── send.php              # Emails with files
│   │   └── send_cid.php          # Inline images
│   ├── templates/
│   │   └── send.php              # Templates with merge values
│   ├── scheduling/
│   │   └── send.php              # Delayed delivery (TimeOffset)
│   ├── contacts/
│   │   └── manage.php            # Contacts and lists
│   ├── domains/
│   │   └── manage.php            # Domain verification
│   ├── webhooks/
│   │   ├── manage.php            # Create, list, delete webhooks
│   │   └── handler.php           # Standalone event endpoint
│   ├── inbound/
│   │   ├── manage.php            # Inbound routes
│   │   └── handler.php           # Standalone inbound endpoint
│   ├── double-optin/
│   │   ├── subscribe.php         # Subscribe + confirmation email
│   │   ├── confirm.php           # HMAC confirm endpoint
│   │   └── webhook.php           # Click-based confirm endpoint
│   ├── suppressions/
│   │   └── manage.php            # Unsubscribes, bounces, complaints
│   ├── verification/
│   │   └── verify.php            # Verify an address
│   ├── statistics/
│   │   └── summary.php           # Account statistics
│   ├── subaccounts/
│   │   └── manage.php            # Sub-accounts (read-only by default)
│   └── slim_app.php              # Slim web application
├── symfony_app/                  # Symfony web application
│   ├── config/routes.php
│   ├── public/index.php
│   ├── src/Controller/
│   ├── src/Service/ElasticEmail.php
│   └── composer.json
├── composer.json
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email PHP SDK](https://github.com/ElasticEmail/elasticemail-php)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
