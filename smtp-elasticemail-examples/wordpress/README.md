# Send Email from WordPress with SMTP - Elastic Email

Make every email your WordPress site sends (password resets, WooCommerce orders, contact form
notifications, anything that calls `wp_mail()`) go through the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay instead of the host's PHP `mail()`.
This guide uses the WP Mail SMTP plugin and keeps the credentials in `wp-config.php`.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A WordPress site and an administrator account
- The [WP Mail SMTP](https://wordpress.org/plugins/wp-mail-smtp/) plugin (the free version is enough)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: Plugin settings

1. Go to **WP Mail SMTP > Settings**.
2. Set the sender:

   | Field | Value |
   |---|---|
   | From Email | `hello@yourdomain.com` (on your verified domain) |
   | Force From Email | on, so plugins can't send from other addresses |
   | From Name | your site name |
   | Mailer | **Other SMTP** |

3. Fill in the SMTP section:

   | Field | Value |
   |---|---|
   | SMTP Host | `smtp.elasticemail.com` |
   | Encryption | TLS |
   | SMTP Port | `2525` (or `587`) |
   | Auto TLS | on |
   | Authentication | on |
   | SMTP Username | your Elastic Email SMTP username |
   | SMTP Password | your Elastic Email SMTP password |

4. Click **Save Settings**.

For port 465, choose **SSL** as the encryption.

## Option 2: wp-config.php (recommended)

The plugin stores the password in the database unless you define it as a constant. Constants also
make staging and production easy to keep apart. Add this above `/* That's all, stop editing! */`:

```php
define( 'WPMS_ON', true );
define( 'WPMS_MAILER', 'smtp' );
define( 'WPMS_MAIL_FROM', 'hello@yourdomain.com' );
define( 'WPMS_MAIL_FROM_FORCE', true );
define( 'WPMS_MAIL_FROM_NAME', 'Acme' );
define( 'WPMS_SMTP_HOST', 'smtp.elasticemail.com' );
define( 'WPMS_SMTP_PORT', 2525 );
define( 'WPMS_SSL', 'tls' );
define( 'WPMS_SMTP_AUTOTLS', true );
define( 'WPMS_SMTP_AUTH', true );
define( 'WPMS_SMTP_USER', getenv( 'ELASTICEMAIL_SMTP_USERNAME' ) );
define( 'WPMS_SMTP_PASS', getenv( 'ELASTICEMAIL_SMTP_PASSWORD' ) );
```

The settings page now shows these fields as locked. If your host doesn't pass environment
variables to PHP, put the values in directly, since `wp-config.php` isn't publicly readable.

## Test it

Go to **WP Mail SMTP > Tools > Email Test**, enter your address and click **Send Email**. On
failure, the plugin shows the full SMTP conversation, including the reply from Elastic Email.

## Notes

- Contact forms that set the **From** to the visitor's address will be rejected, because that
  domain isn't verified. Keep **Force From Email** on and let the form put the visitor in `Reply-To`.
- Elastic Email also publishes its own [WordPress plugin](https://wordpress.org/plugins/elastic-email-sender/),
  which sends through the API and adds reports in the WordPress admin. Use one plugin or the other,
  not both.
- WooCommerce order emails, membership plugins and form plugins all go through `wp_mail()`, so they
  pick this up without any configuration of their own.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [WP Mail SMTP: Other SMTP mailer](https://wpmailsmtp.com/docs/how-to-set-up-the-other-smtp-mailer-in-wp-mail-smtp/)
- [WP Mail SMTP: Securing SMTP settings with constants](https://wpmailsmtp.com/docs/how-to-secure-smtp-settings-by-using-constants/)
- [All SMTP integrations](../README.md)

## License

MIT
