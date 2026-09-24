# Send Email from PocketBase with SMTP - Elastic Email

Send PocketBase's verification, password reset, email change, OTP and login alert emails through
the [Elastic Email](https://elasticemail.com/email-api) SMTP relay. PocketBase falls back to the
local `sendmail` binary until you switch on SMTP under **Settings > Mail settings** in the
dashboard, or set the same values from a migration.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A PocketBase app (v0.23 or newer for the migration example) and a superuser account
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: Dashboard

1. Open the dashboard (`/_/`) and go to **Settings > Mail settings**.
2. Set the sender:

   | PocketBase field | Value |
   |---|---|
   | Sender name | `Acme` |
   | Sender address | `no-reply@yourdomain.com` (on your verified domain) |

3. Turn on **Use SMTP mail server** and fill in:

   | PocketBase field | Value |
   |---|---|
   | SMTP server host | `smtp.elasticemail.com` |
   | Port | `2525` (or `587`) |
   | Username | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |

4. Under **Show more options**, set **TLS encryption** to **Auto (StartTLS)** and leave **AUTH
   method** on **PLAIN (default)**.
5. Click **Save changes**.

For port 465, set **TLS encryption** to **Always**.

## Option 2: Migration with environment variables

The dashboard stores the settings in the app database. To configure a fresh deployment without
clicking through the dashboard, set them from a JS migration and read the credentials from the
environment:

```js
// pb_migrations/1700000000_elasticemail_smtp.js
migrate((app) => {
  const settings = app.settings();

  settings.meta.senderName = "Acme";
  settings.meta.senderAddress = "no-reply@yourdomain.com";

  settings.smtp.enabled = true;
  settings.smtp.host = "smtp.elasticemail.com";
  settings.smtp.port = 2525;
  settings.smtp.tls = false; // false = STARTTLS; true only for port 465
  settings.smtp.username = $os.getenv("ELASTICEMAIL_SMTP_USERNAME");
  settings.smtp.password = $os.getenv("ELASTICEMAIL_SMTP_PASSWORD");

  app.save(settings);
});
```

```bash
export ELASTICEMAIL_SMTP_USERNAME="you@yourdomain.com"
export ELASTICEMAIL_SMTP_PASSWORD="your_smtp_password"
./pocketbase serve
```

In a Go app, the same fields are on `app.Settings().SMTP` and `app.Settings().Meta`
(`Enabled`, `Host`, `Port`, `TLS`, `Username`, `Password`), saved with `app.Save(settings)`.

PocketBase keeps the settings, password included, in its database. To encrypt them at rest, start
the server with `--encryptionEnv` pointing to an environment variable that holds a 32-character key.

## Test it

On the **Mail settings** page, click **Send test email**, choose a template (for example
**Verification**), enter your address and click **Send**. Any SMTP error is shown in the dashboard
and written to **Logs**.

## Notes

- `tls = false` doesn't mean unencrypted: PocketBase sends `STARTTLS` and Elastic Email upgrades the
  connection. Set it to `true` only on port 465.
- Edit the email templates per auth collection, under the collection's **Options** tab. The
  sender stays the one set in Mail settings.
- Emails you send from hooks with `$app.newMailClient()` use the same SMTP settings.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [PocketBase: Going to production (SMTP)](https://pocketbase.io/docs/going-to-production/)
- [PocketBase: Sending emails (JS)](https://pocketbase.io/docs/js-sending-emails/)
- [PocketBase: Sending emails (Go)](https://pocketbase.io/docs/go-sending-emails/)
- [All SMTP integrations](../README.md)

## License

MIT
