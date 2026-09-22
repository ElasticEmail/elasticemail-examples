# Send your first email with Laravel

Five minutes from a clean Laravel 11 project to a delivered email, calling the Elastic Email PHP SDK
through a small service class.

## Why not Laravel's Mail facade?

You can point Laravel's SMTP transport at Elastic Email and use `Mail::send()`. These examples take
the API route instead, because the API hands back a `TransactionID` and a `MessageID` for every send.
Those ids are what you need to check delivery, correlate webhook events and support a customer asking
where their receipt went. Blade still renders the HTML - it is passed as the body rather than handed
to a mailer.

## Prerequisites

- PHP 8.2+ and Composer
- A Laravel 11 project (`composer create-project laravel/laravel`)
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

These files drop into a fresh Laravel 11 project. Copy `app/`, `config/`, `routes/api.php` and
`resources/views/emails/` over the skeleton, then:

```bash
composer require elasticemail/elasticemail-php:^4.2

cp .env.example .env
php artisan key:generate
php artisan install:api     # Laravel 11 ships without routes/api.php
```

## 4. Set your environment variables

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
CONTACT_EMAIL=team@yourdomain.com
PUBLIC_URL=http://localhost:8000
```

`config/elasticemail.php` reads these, so the rest of the app never touches `env()` directly. Full
list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

`App\Services\ElasticEmail` is registered as a singleton and autowired into controllers:

```php
use App\Services\ElasticEmail;

class EmailController extends Controller
{
    public function __construct(private ElasticEmail $ee) {}

    public function sendWelcome(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'name' => 'required|string',
        ]);

        try {
            $html = view('emails.welcome', [
                'name' => $request->name,
                'actionUrl' => config('elasticemail.public_url'),
            ])->render();

            return $this->sent($this->ee->sendHtml($request->email, "Welcome, {$request->name}!", $html));
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }
}
```

`sent()` and `fail()` are two helpers on the base controller: one returns
`{ success, transactionId, messageId }`, the other turns an `ApiException` into
`{ error }` with the API's own status code.

`sendHtml()` covers the common case. Extra `EmailContent` keys (snake_case: `attachments`, `headers`,
`reply_to`) go in the third argument; `Options` such as `time_offset` in the fourth.

## 6. Run it

```bash
php artisan serve
```

```bash
curl -X POST http://localhost:8000/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Laravel!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

Or from the console:

```bash
php artisan email:send-test you@yourdomain.com --name="Ann"
```

## What else is wired up

| Route | Does |
|---|---|
| `POST /api/send/welcome` | Blade view rendered and sent |
| `POST /api/send/attachment` | Uploaded file attached (multipart) |
| `POST /api/send/cid` | Inline image referenced as `cid:logo.png` |
| `POST /api/send/template` | Hosted template, created on first use |
| `POST /api/send/batch` | Bulk send with per-recipient merge fields |
| `POST /api/contact` | Contact form: confirmation to the visitor, notification to the team |
| `GET|POST /api/webhook?token=` | Event notifications |
| `POST /api/inbound?token=` | Inbound mail, forwarded to `CONTACT_EMAIL` |
| `/api/contacts`, `/api/domains`, `/api/double-optin/*` | Full CRUD, see the README |

## Next steps

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Build a signup that confirms by email | [Double opt-in](../docs/double-opt-in.md) |
| Every route, request shape and response | [README.md](README.md) |
