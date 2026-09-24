# Send Email from Appwrite with SMTP - Elastic Email

Send Appwrite's verification emails, password recovery, magic URL and email OTP sign-ins, and team
invitations through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay. A
self-hosted Appwrite server reads the relay from its `_APP_SMTP_*` environment variables. On
Appwrite Cloud, each project has its own custom SMTP form.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A self-hosted Appwrite server (Docker Compose), or an Appwrite Cloud project on a plan that includes custom SMTP
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: Self-hosted (environment variables)

Edit the `.env` file next to your Appwrite `docker-compose.yml`:

```bash
# .env
_APP_SYSTEM_EMAIL_NAME=Acme
_APP_SYSTEM_EMAIL_ADDRESS=no-reply@yourdomain.com
_APP_SMTP_HOST=smtp.elasticemail.com
_APP_SMTP_PORT=2525
_APP_SMTP_SECURE=tls
_APP_SMTP_USERNAME=you@yourdomain.com
_APP_SMTP_PASSWORD=your_smtp_password
```

`_APP_SYSTEM_EMAIL_ADDRESS` is the sender recipients see, so it must be on your verified domain.

`_APP_SMTP_SECURE` accepts an empty value, `tls` or `ssl`:

| Port | `_APP_SMTP_SECURE` |
|---|---|
| `2525`, `587` | `tls` (STARTTLS) |
| `465` | `ssl` (implicit TLS) |

Leave it at `tls` on 2525 and 587. With an empty value Appwrite doesn't upgrade the connection,
and it would send the password over plain text.

Apply the change and check the values the containers picked up:

```bash
docker compose up -d
docker compose exec appwrite vars
```

## Option 2: Appwrite Cloud (project settings)

1. Open your project and go to **Settings**, then the **SMTP** tab.
2. Under **SMTP server**, turn on **Custom SMTP server** and fill in:

   | Appwrite field | Value |
   |---|---|
   | Sender name | `Acme` |
   | Sender email | `no-reply@yourdomain.com` (on your verified domain) |
   | Server host | `smtp.elasticemail.com` |
   | Server port | `2525` (or `587`, `465`) |
   | Username | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |

3. Click **Update**.

Project SMTP settings apply to that project only. On a self-hosted server, the `_APP_SMTP_*`
variables are the server-wide default for every project.

## Test it

Create a user and send the verification email from any Appwrite client SDK:

```js
await account.create(ID.unique(), "you@yourdomain.com", "a-strong-password");
await account.createEmailPasswordSession("you@yourdomain.com", "a-strong-password");
await account.createVerification("https://yourapp.com/verify");
```

On a self-hosted server, emails go out from the `appwrite-worker-mails` container. If nothing
arrives, check its log for the SMTP reply from Elastic Email:

```bash
docker compose logs -f appwrite-worker-mails
```

## Notes

- Custom email templates (under **Auth > Templates**) need a custom SMTP server. The built-in mailer
  only sends the default templates.
- The sender on a custom template must stay on your verified domain, or Elastic Email rejects the message.
- Mail from Appwrite Messaging uses its own providers. Add an SMTP provider under **Messaging >
  Providers** with the same values if you want messages sent there to go through Elastic Email too.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Appwrite: Email delivery (self-hosting)](https://appwrite.io/docs/advanced/self-hosting/configuration/email)
- [Appwrite: Custom SMTP and message templates](https://appwrite.io/docs/products/auth/message-templates)
- [All SMTP integrations](../README.md)

## License

MIT
