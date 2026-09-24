# Send Email from Nextcloud with SMTP - Elastic Email

Send Nextcloud's share notifications, password resets, activity digests and calendar invitations
through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay. Set it in the
**Email server** section of the administration settings, or write the same `mail_*` values into
`config.php` with `occ`. The official Docker image also reads them from environment variables.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Nextcloud server and an admin account (plus shell access for Options 2 and 3)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: Administration settings

1. Click your avatar, choose **Administration settings**, then **Basic settings**.
2. Fill in the **Email server** section:

   | Nextcloud field | Value |
   |---|---|
   | Send mode | SMTP |
   | Encryption | None/STARTTLS |
   | From address | `cloud` @ `yourdomain.com` (on your verified domain) |
   | Server address | `smtp.elasticemail.com` : `2525` |
   | Authentication | on |
   | Credentials | your Elastic Email SMTP username and password |

3. Save the settings. Recent versions save each field as you change it; older ones have a **Save** button.

For port 465, choose **SSL** as the encryption. With **None/STARTTLS** Nextcloud upgrades the
connection with STARTTLS whenever the server offers it, and Elastic Email always does.

## Option 2: occ (config.php)

`occ` writes the same keys to `config/config.php`. Run it as the web server user, and read the
password from the environment so it doesn't land in your shell history:

```bash
export ELASTICEMAIL_SMTP_USERNAME="you@yourdomain.com"
export ELASTICEMAIL_SMTP_PASSWORD="your_smtp_password"

sudo -E -u www-data php occ config:system:set mail_smtpmode --value=smtp
sudo -E -u www-data php occ config:system:set mail_smtphost --value=smtp.elasticemail.com
sudo -E -u www-data php occ config:system:set mail_smtpport --value=2525 --type=integer
sudo -E -u www-data php occ config:system:set mail_smtpsecure --value=""
sudo -E -u www-data php occ config:system:set mail_smtpauth --value=true --type=boolean
sudo -E -u www-data php occ config:system:set mail_smtpname --value="$ELASTICEMAIL_SMTP_USERNAME"
sudo -E -u www-data php occ config:system:set mail_smtppassword --value="$ELASTICEMAIL_SMTP_PASSWORD"
sudo -E -u www-data php occ config:system:set mail_from_address --value=cloud
sudo -E -u www-data php occ config:system:set mail_domain --value=yourdomain.com
```

`mail_from_address` is only the part before the `@`, and `mail_domain` is the part after it.
`mail_smtpsecure` is empty for STARTTLS on 2525 and 587, and `ssl` for port 465.

## Option 3: Docker environment variables

The official `nextcloud` image fills in the same settings from its environment:

```yaml
services:
  app:
    image: nextcloud
    environment:
      SMTP_HOST: smtp.elasticemail.com
      SMTP_PORT: 587
      SMTP_SECURE: tls
      SMTP_AUTHTYPE: LOGIN
      SMTP_NAME: ${ELASTICEMAIL_SMTP_USERNAME}
      SMTP_PASSWORD: ${ELASTICEMAIL_SMTP_PASSWORD}
      MAIL_FROM_ADDRESS: cloud
      MAIL_DOMAIN: yourdomain.com
```

`SMTP_SECURE=tls` means STARTTLS in the image's variables; use `ssl` with port 465. The image also
accepts `SMTP_PASSWORD_FILE` to read the password from a Docker secret.

## Test it

Nextcloud sends the test message to your own account, so first add an email address under
**Personal settings > Personal info**. Then click **Send email** in the **Email server** section.
If it fails, the error shown includes the reply from Elastic Email. More detail is in
**Administration settings > Logging**.

## Notes

- Background jobs send activity and notification emails. Make sure cron (or the AJAX/webcron
  fallback) runs, or those emails pile up unsent.
- Every email Nextcloud sends uses the `mail_from_address@mail_domain` sender, so that domain is
  the one to verify in Elastic Email.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Nextcloud: Email configuration](https://docs.nextcloud.com/server/latest/admin_manual/configuration_server/email_configuration.html)
- [Nextcloud Docker image: E-mail (SMTP) configuration](https://github.com/nextcloud/docker#e-mail-smtp-configuration)
- [All SMTP integrations](../README.md)

## License

MIT
