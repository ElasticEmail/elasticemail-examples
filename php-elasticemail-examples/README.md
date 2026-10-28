# PHP Email API Examples - Elastic Email

Send transactional and bulk email from PHP with the [Elastic Email](https://elasticemail.com/email-api) email API. Standalone scripts plus two web applications - Slim and Symfony - built on the official Elastic Email PHP SDK.

> **First time here?** The [PHP quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `elasticemail/elasticemail-php@4.4.0` · PHP 8.2+ · Slim 4, Symfony 6.4/7

## Prerequisites

- PHP 8.2+ (8.2.35, 8.3.36, 8.4.27, 8.5.12 or newer; earlier releases are open to CVE-2026-109618 and CVE-2026-109619)
- Composer
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

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

### Bulk Sending
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
# Create a signed POST + JSON webhook pointing at PUBLIC_URL/webhook, rotate its secret, delete it
php src/webhooks/manage.php

# Standalone handler (serve behind a public URL, e.g. ngrok)
php -S localhost:3000 src/webhooks/handler.php
```

`manage.php` prints the webhook's `SigningSecret`; store it as `ELASTICEMAIL_WEBHOOK_SECRET` (it is shown only once). With it set, the handlers require a valid `X-ElasticEmail-Signature` (HMAC-SHA256 over timestamp, method, raw request target and raw body) and answer `401` otherwise. Leave it empty to use unsigned webhooks with `?token=ELASTICEMAIL_WEBHOOK_TOKEN` in the URL instead.

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
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`; an optional `Idempotency-Key` request header is forwarded to Elastic Email (a new key is generated otherwise), so clients can retry safely with the same key
- `GET|POST /webhook` - Elastic Email event notifications (`status`, `to`, `transaction`, `messageid`, `target`, ...). Recommended: a signed webhook with `DeliveryMethod: PostJson`, which sends each event as a POST with a JSON body; set `ELASTICEMAIL_WEBHOOK_SECRET` and the route verifies the signature (`401` if it is missing or wrong). Fallback for unsigned webhooks: leave the secret empty, add `?token=...` matching `ELASTICEMAIL_WEBHOOK_TOKEN` to the URL, and the details arrive in the query string of a GET.
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `GET|POST /double-optin/webhook` - confirms on a `Clicked` event whose `target` is the confirm link (signed, or `?token=...` like `/webhook`)

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
│   │   ├── manage.php            # Create a signed webhook, rotate its secret, delete it
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
