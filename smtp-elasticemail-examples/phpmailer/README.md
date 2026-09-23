# Send Email from PHPMailer with SMTP - Elastic Email

Send email from plain PHP with [PHPMailer](https://github.com/PHPMailer/PHPMailer) and the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. It works in legacy apps, cron
scripts and any codebase where PHP's `mail()` depends on the host's local mail server.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).
> Prefer the REST API? The [PHP examples](../../php-elasticemail-examples/) use the official `elasticemail/elasticemail-php` SDK with Slim and Symfony.

## Prerequisites

- PHP 8.1+ with the `openssl` extension, and Composer
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Setup

```bash
composer require phpmailer/phpmailer vlucas/phpdotenv
cp ../.env.example .env   # then fill in the SMTP username, password, EMAIL_FROM and EMAIL_TO
```

## Send

```php
<?php
// send.php
require __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

Dotenv\Dotenv::createImmutable(__DIR__)->safeLoad();

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = $_ENV['ELASTICEMAIL_SMTP_HOST'] ?? 'smtp.elasticemail.com';
    $mail->Port = (int) ($_ENV['ELASTICEMAIL_SMTP_PORT'] ?? 2525);
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // ENCRYPTION_SMTPS for port 465
    $mail->SMTPAuth = true;
    $mail->Username = $_ENV['ELASTICEMAIL_SMTP_USERNAME'];
    $mail->Password = $_ENV['ELASTICEMAIL_SMTP_PASSWORD'];
    $mail->CharSet = PHPMailer::CHARSET_UTF8;

    // Accepts "Acme <hello@yourdomain.com>" or a bare address.
    [$fromAddress] = PHPMailer::parseAddresses($_ENV['EMAIL_FROM']);
    $mail->setFrom($fromAddress['address'], $fromAddress['name']);
    $mail->addAddress($_ENV['EMAIL_TO']);

    $mail->isHTML(true);
    $mail->Subject = 'Hello from PHPMailer';
    $mail->Body = '<p>It works. This message went through <strong>Elastic Email SMTP</strong>.</p>';
    $mail->AltBody = 'It works. This message went through Elastic Email SMTP.';

    $mail->send();
    echo "Sent. Message-ID: {$mail->getLastMessageID()}\n";
} catch (Exception $e) {
    fwrite(STDERR, "Send failed: {$mail->ErrorInfo}\n");
    exit(1);
}
```

```bash
php send.php
```

## Debugging

Set `$mail->SMTPDebug = PHPMailer\PHPMailer\SMTP::DEBUG_SERVER;` before `send()` to print the
full SMTP conversation. Look for `235` after `AUTH` (credentials accepted) and `250` after the
message body (message accepted). Remove it before production, because it prints the base64-encoded
credentials.

## Notes

- `ENCRYPTION_STARTTLS` goes with ports 2525, 587 and 25. `ENCRYPTION_SMTPS` goes with 465.
  Swapping them produces a connection that hangs, then times out.
- `AltBody` is the plain-text part. Keep it: some clients show only text, and spam filters score
  HTML-only mail worse.
- To send many messages in one run, set `$mail->SMTPKeepAlive = true`, and call
  `clearAddresses()` and `clearAttachments()` between messages to reuse one connection.
- Attachments use `addAttachment($path)`, and inline images use `addEmbeddedImage($path, 'logo')`
  with `<img src="cid:logo">`.

## AI assistant prompt

```
Send email from PHP 8.1+ with PHPMailer through the Elastic Email SMTP relay. Use isSMTP() with
Host smtp.elasticemail.com, Port 2525, SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS (ENCRYPTION_SMTPS
only for port 465), SMTPAuth = true, and Username/Password from ELASTICEMAIL_SMTP_USERNAME and
ELASTICEMAIL_SMTP_PASSWORD loaded with vlucas/phpdotenv. The password is the SMTP password from
Elastic Email Settings > SMTP, not an API key. Never hardcode credentials. The From address comes
from EMAIL_FROM and must be on a domain verified in Elastic Email. Set both Body (HTML) and AltBody
(text). Construct PHPMailer with true to throw exceptions and print $mail->ErrorInfo on failure.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [PHPMailer on GitHub](https://github.com/PHPMailer/PHPMailer)
- [PHPMailer: Troubleshooting](https://github.com/PHPMailer/PHPMailer/wiki/Troubleshooting)
- [All SMTP integrations](../README.md)

## License

MIT
