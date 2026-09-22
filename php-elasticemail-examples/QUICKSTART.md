# Send your first email with PHP

Five minutes from a clean clone to a delivered email, using the Elastic Email PHP SDK. Works plain,
with Slim, or with Symfony.

## Prerequisites

- PHP 8.1+ and Composer
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/php-elasticemail-examples

composer install
cp .env.example .env
```

In a project of your own:

```bash
composer require elasticemail/elasticemail-php vlucas/phpdotenv
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

Full list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

```php
<?php
require 'vendor/autoload.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Configuration;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\TransactionalRecipient;

$config = Configuration::getDefaultConfiguration()
    ->setApiKey('X-ElasticEmail-ApiKey', getenv('ELASTICEMAIL_API_KEY'));

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), $config);

$result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
    'recipients' => new TransactionalRecipient(['to' => ['you@yourdomain.com']]),
    'content' => new EmailContent([
        'from' => 'Acme <hello@yourdomain.com>',
        'subject' => 'Hello from Elastic Email!',
        'body' => [
            new BodyPart(['content_type' => 'HTML', 'content' => '<h1>Welcome!</h1>']),
            new BodyPart(['content_type' => 'PlainText', 'content' => 'Welcome!']),
        ],
    ]),
]));

echo 'Transaction ID: ' . $result->getTransactionId() . "\n";
```

Model constructors take **snake_case** keys - `content_type`, `binary_content`, `template_name`,
`time_offset` - while the wire format is PascalCase. The SDK translates.

Run the version in this repository:

```bash
php src/send/basic.php
```

`src/bootstrap.php` loads `.env`, builds the `Configuration` once and exposes `ee_config()`,
`ee_from()`, `ee_to()` and the error helpers every script uses.

## 6. Or run a web app

Slim:

```bash
php -S localhost:8080 src/slim_app.php

curl -X POST http://localhost:8080/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from PHP!"}'
```

Symfony:

```bash
cd symfony_app
composer install
php -S localhost:8081 -t public
```

Both expose the same routes and the same JSON shapes.

## Handling failures

```php
try {
    $result = $emailsApi->emailsTransactionalPost($data);
} catch (ElasticEmail\ApiException $e) {
    $status = $e->getCode();
    $body = $e->getResponseBody();   // {"Error": "..."}
}
```

`ee_error_details()` in `src/bootstrap.php` turns that into `['status' => int, 'message' => string]`,
which is what the web apps return. See [Error handling](../docs/error-handling.md).

## Next steps

```bash
php src/send/batch.php             # one call, personalized per recipient
php src/attachments/send.php       # base64 file attachment
php src/attachments/send_cid.php   # inline image via cid:
php src/templates/send.php         # hosted template + merge values
php src/webhooks/manage.php        # create, list, delete a webhook
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every script and route | [README.md](README.md) |
