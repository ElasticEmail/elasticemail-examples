# Send Email from Laravel with SMTP - Elastic Email

Point Laravel's built-in `smtp` mailer at the [Elastic Email](https://elasticemail.com/email-api)
SMTP relay and every Mailable, notification and queued email goes out through it. It only takes a
few `MAIL_*` lines in `.env`, with no package and no code changes.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).
> Need templates, contacts or webhooks from code? The [Laravel examples](../../laravel-elasticemail-examples/) use the REST API through the official PHP SDK.

## Prerequisites

- Laravel 10, 11 or 12 (PHP 8.2+)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Configure

```bash
# .env
MAIL_MAILER=smtp
MAIL_HOST=smtp.elasticemail.com
MAIL_PORT=2525
MAIL_USERNAME=you@yourdomain.com
MAIL_PASSWORD=your_smtp_password
MAIL_FROM_ADDRESS=hello@yourdomain.com
MAIL_FROM_NAME="${APP_NAME}"
```

Leave `MAIL_SCHEME` (Laravel 11+) or `MAIL_ENCRYPTION` (Laravel 10) unset on ports 2525 and 587.
Symfony Mailer upgrades to TLS with STARTTLS on its own. For port 465, set `MAIL_SCHEME=smtps`
(Laravel 11+) or `MAIL_ENCRYPTION=ssl` (Laravel 10).

After changing `.env` on a server that caches configuration, run `php artisan config:clear`.

## Send a test

```bash
php artisan tinker
```

```php
Mail::raw('It works. This message went through Elastic Email SMTP.', fn ($m) => $m->to('you@yourdomain.com')->subject('Hello from Laravel'));
```

## A Mailable with HTML and text

```bash
php artisan make:mail Welcome
```

```php
// app/Mail/Welcome.php
namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class Welcome extends Mailable
{
    use Queueable;

    public function __construct(public string $name) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Welcome, {$this->name}");
    }

    public function content(): Content
    {
        return new Content(view: 'mail.welcome', text: 'mail.welcome-text');
    }
}
```

```blade
{{-- resources/views/mail/welcome.blade.php --}}
<p>Hi {{ $name }}, thanks for signing up.</p>
```

```blade
{{-- resources/views/mail/welcome-text.blade.php --}}
Hi {{ $name }}, thanks for signing up.
```

```php
Mail::to($user->email)->send(new Welcome($user->name));
// or, with a queue worker running:
Mail::to($user->email)->queue(new Welcome($user->name));
```

## Notes

- `MAIL_FROM_ADDRESS` is the default sender for every message. It, and any address passed to
  `->from()`, must be on your verified domain.
- Notifications (`toMail()`), password resets and email verification all use the default mailer,
  so they switch to Elastic Email with no extra work.
- To keep SMTP for app mail and use the API for something else, define a second mailer in
  `config/mail.php` and choose it with `Mail::mailer('name')`.
- An SMTP failure throws `Symfony\Component\Mailer\Exception\TransportException`, whose message
  contains the SMTP reply from Elastic Email. Queued mail logs it on the failed job.

## AI assistant prompt

```
Configure a Laravel app to send all mail through the Elastic Email SMTP relay using the built-in
smtp mailer, with no package. In .env set MAIL_MAILER=smtp, MAIL_HOST=smtp.elasticemail.com,
MAIL_PORT=2525, MAIL_USERNAME and MAIL_PASSWORD to the SMTP credentials from Elastic Email
Settings > SMTP (not an API key), and MAIL_FROM_ADDRESS to a sender on a domain verified in Elastic
Email. Leave MAIL_SCHEME unset for STARTTLS on 2525/587; use smtps only with port 465. Never
hardcode credentials in config/mail.php. Mailables should define both an HTML view and a text view
in content().
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Laravel: Mail](https://laravel.com/docs/mail)
- [Laravel: Notifications](https://laravel.com/docs/notifications#mail-notifications)
- [All SMTP integrations](../README.md)

## License

MIT
