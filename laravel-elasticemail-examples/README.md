# Laravel Email API Examples - Elastic Email

Send transactional and bulk email from Laravel 13 with the [Elastic Email](https://elasticemail.com/email-api) email API, with Blade templates rendered into the HTML body.

The examples call the Elastic Email PHP SDK directly through a small service class
(`app/Services/ElasticEmail.php`). Blade views are rendered with `view()->render()` and passed
as the HTML body. Laravel's Mail transport is not used, so you get the `TransactionID` and
`MessageID` back from every send.

> **First time here?** The [Laravel quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

**Versions:** Elastic Email REST API v4 · SDK `elasticemail/elasticemail-php@4.4.0` · PHP 8.3+ · Laravel 13

## Prerequisites

- PHP 8.3+ (8.3.36, 8.4.27, 8.5.12 or newer; earlier releases are open to CVE-2026-109618 and CVE-2026-109619)
- Composer
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

These files drop into a fresh Laravel 13 project (`composer create-project laravel/laravel`).
Copy `app/`, `config/`, `routes/api.php` and `resources/views/emails/` over the skeleton, then:

```bash
# Install the SDK
composer require elasticemail/elasticemail-php:^4.4

# Copy environment variables
cp .env.example .env
php artisan key:generate

# Add your Elastic Email API key to .env

# Enable API routes (Laravel 13 does not ship routes/api.php by default)
php artisan install:api

php artisan serve
```

## Configuration

`config/elasticemail.php` reads these variables:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
CONTACT_EMAIL=team@yourdomain.com
ELASTICEMAIL_WEBHOOK_SECRET=
ELASTICEMAIL_WEBHOOK_TOKEN=change_me
ELASTICEMAIL_LIST_NAME=Newsletter
ELASTICEMAIL_TEMPLATE_NAME=welcome-example
PUBLIC_URL=http://localhost:8000
SENDING_DOMAIN=yourdomain.com
CONFIRM_REDIRECT_URL=
```

## API Endpoints

### Email Sending

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | | Health check |
| POST | `/api/send` | `{ to, subject, message }` | Plain send, same shape as the other stacks; an optional `Idempotency-Key` request header is forwarded to Elastic Email (a new key is generated otherwise), so clients can retry safely with the same key |
| POST | `/api/send/welcome` | `{ email, name }` | Welcome email rendered from a Blade view |
| POST | `/api/send/direct` | `{ email, subject, message }` | Plain send |
| POST | `/api/send/scheduled` | `{ email, time_offset }` | Delayed delivery, minutes from now (max 50400) |
| POST | `/api/send/attachment` | multipart `email`, `attachment` | Uploaded file as attachment |
| POST | `/api/send/cid` | `{ email }` | Inline image referenced as `cid:logo.png` |
| POST | `/api/send/template` | `{ email, template_name?, merge? }` | Template send, template created on first use |
| POST | `/api/send/prevent-threading` | `{ email, subject, message }` | Unique `X-Entity-Ref-ID` header |
| POST | `/api/send/batch` | `{ recipients: [{ email, fields }], subject?, html? }` | Bulk send with merge fields |
| POST | `/api/contact` | `{ name, email, message }` | Contact form: confirmation + team notification |

Sends return `{ success: true, transactionId, messageId }`.

### Webhooks and Inbound

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET, POST | `/api/webhook` | Event notifications (status, to, transaction, target, ...): signed, or `?token=` for unsigned webhooks |
| POST | `/api/inbound?token=` | Inbound email pushed by an inbound route, forwarded to `CONTACT_EMAIL` |

Recommended: create the webhook with `EnableSigning: true` and `DeliveryMethod: PostJson`, so
each event arrives as a POST with a JSON body and an HMAC-SHA256 signature. The create response
contains `SigningSecret` (shown only once); put it in `ELASTICEMAIL_WEBHOOK_SECRET`. With it set,
`/api/webhook` and `/api/double-optin/webhook` verify `X-ElasticEmail-Signature` over the timestamp,
method, raw request URI and raw body (`$request->getContent()`), reject timestamps more than
5 minutes off, and return 401 on mismatch, so Elastic Email retries.

Fallback for unsigned webhooks: leave `ELASTICEMAIL_WEBHOOK_SECRET` empty and add
`?token=ELASTICEMAIL_WEBHOOK_TOKEN` to the webhook URL; the events then arrive as GET requests with
the details in the query string. Inbound email is never signed, so `/api/inbound` always checks
`?token=` and returns 401 on mismatch.

When you save a webhook, Elastic Email sends one test event (`to=test@test.com`,
`messageid=abc1234`). For an unsigned webhook it saves the webhook only if it gets a 2xx response,
and the handler accepts it like any other event; in your own app, skip it before it reaches your
data. A signed webhook's test arrives before your app knows the secret; Elastic Email accepts a
401/403 answer to it, so the webhook is still created. Signed and POST webhooks don't follow
redirects.

### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts?list=&limit=&offset=` | List contacts (on a list, or account-wide) |
| POST | `/api/contacts` | `{ email, first_name, last_name, list, custom_fields }`, creates the list if missing |
| GET | `/api/contacts/{email}` | Get a contact |
| PATCH | `/api/contacts/{email}` | Update first/last name or custom fields |
| DELETE | `/api/contacts/{email}` | Delete a contact |

### Domains

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/domains` | List domains with SPF/DKIM/MX/DMARC flags |
| POST | `/api/domains` | `{ domain }`, add a domain (defaults to `SENDING_DOMAIN`) |
| GET | `/api/domains/{domain}` | Domain details including `dkimRecord` |
| POST | `/api/domains/{domain}/verify-tracking` | Verify the tracking CNAME |
| POST | `/api/domains/{domain}/default` | `{ email }`, set the account default sender |

### Double Opt-In

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/double-optin/subscribe` | `{ email, name }`, stores the contact as Transactional and emails an HMAC confirm link |
| GET | `/api/double-optin/confirm?email=&token=` | Validates the HMAC and adds the contact to `ELASTICEMAIL_LIST_NAME` |
| GET, POST | `/api/double-optin/webhook` | Confirms on a `Clicked` event whose `target` is the confirm link (signed, or `?token=`) |

Failures return `{ error: "<message from the API>" }` with the API status code.

## Usage Examples

### Send
```bash
curl -X POST http://localhost:8000/api/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Laravel!"}'
```

### Welcome Email (Blade view)
```bash
curl -X POST http://localhost:8000/api/send/welcome \
  -H "Content-Type: application/json" \
  -d '{"email": "you@yourdomain.com", "name": "Ann"}'
```

### Scheduled
```bash
curl -X POST http://localhost:8000/api/send/scheduled \
  -H "Content-Type: application/json" \
  -d '{"email": "you@yourdomain.com", "time_offset": 60}'
```

### Batch with merge fields
```bash
curl -X POST http://localhost:8000/api/send/batch \
  -H "Content-Type: application/json" \
  -d '{"recipients": [{"email": "you@yourdomain.com", "fields": {"firstname": "Ann", "plan": "Pro"}}]}'
```

### Add a contact
```bash
curl -X POST http://localhost:8000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"email": "you@yourdomain.com", "first_name": "Ann", "list": "Newsletter"}'
```

### Artisan Command
```bash
php artisan email:send-test you@yourdomain.com --name="Ann"
```

## Project Structure

```
laravel-elasticemail-examples/
├── app/
│   ├── Console/Commands/
│   │   └── SendTestEmail.php
│   ├── Http/Controllers/
│   │   ├── Controller.php            # Shared error handling
│   │   ├── EmailController.php
│   │   ├── ContactController.php
│   │   ├── DomainController.php
│   │   ├── DoubleOptinController.php
│   │   ├── InboundController.php
│   │   └── WebhookController.php
│   └── Services/
│       └── ElasticEmail.php          # SDK configuration and API instances
├── config/
│   └── elasticemail.php
├── resources/views/emails/
│   ├── welcome.blade.php
│   ├── contact-confirmation.blade.php
│   ├── contact-form.blade.php
│   ├── double-optin-confirm.blade.php
│   ├── inbound-forwarded.blade.php
│   └── inline-image.blade.php
├── routes/
│   └── api.php
├── composer.json
├── .env.example
└── README.md
```

## Quick Usage

```php
use App\Services\ElasticEmail;

$ee = app(ElasticEmail::class);

$result = $ee->sendHtml(
    'you@yourdomain.com',
    'Hello',
    view('emails.welcome', ['name' => 'Ann', 'actionUrl' => config('elasticemail.public_url')])->render()
);

echo $result->getTransactionId(), ' ', $result->getMessageId();
```

Calling the SDK directly:

```php
use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Configuration;
use ElasticEmail\Model\{BodyPart, EmailContent, EmailTransactionalMessageData, TransactionalRecipient};

$config = Configuration::getDefaultConfiguration()->setApiKey('X-ElasticEmail-ApiKey', config('elasticemail.api_key'));
$emailsApi = new EmailsApi(new \GuzzleHttp\Client(), $config);

$result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
    'recipients' => new TransactionalRecipient(['to' => ['you@yourdomain.com']]),
    'content' => new EmailContent([
        'from' => 'Acme <hello@yourdomain.com>',
        'subject' => 'Hello',
        'body' => [new BodyPart(['content_type' => 'HTML', 'content' => '<p>Hello World</p>'])],
    ]),
]));
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email PHP SDK](https://github.com/ElasticEmail/elasticemail-php)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
