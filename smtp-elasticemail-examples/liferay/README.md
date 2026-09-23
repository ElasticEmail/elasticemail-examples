# Send Email from Liferay with SMTP - Elastic Email

Configure Liferay DXP or Liferay Portal to send its notifications, password resets and workflow
emails through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay. Liferay uses
JavaMail under the hood. You can set it once in the Control Panel, or in `portal-ext.properties`
so every environment picks it up from configuration.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- Liferay DXP or Liferay Portal 7.x with an administrator account
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: Control Panel

1. Open **Control Panel > Server Administration** and select the **Mail** tab.
2. Fill in the outgoing server fields:

   | Liferay field | Value |
   |---|---|
   | Outgoing SMTP Server | `smtp.elasticemail.com` |
   | Outgoing Port | `2525` |
   | Use a Secure Network Connection | off (STARTTLS is enabled below) |
   | User Name | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |

3. In **JavaMail Properties**, add:

   ```properties
   mail.smtp.auth=true
   mail.smtp.starttls.enable=true
   mail.smtp.starttls.required=true
   ```

4. Click **Save**.

To use port 465 instead, set the port to `465`, turn on **Use a Secure Network Connection** and
leave out the STARTTLS properties.

## Option 2: portal-ext.properties

Keeping the settings in configuration means a fresh environment sends mail without a manual step.
Values set in the Control Panel take precedence over this file.

```properties
mail.session.mail.smtp.host=smtp.elasticemail.com
mail.session.mail.smtp.port=2525
mail.session.mail.smtp.auth=true
mail.session.mail.smtp.starttls.enable=true
mail.session.mail.smtp.starttls.required=true
mail.session.mail.smtp.user=you@yourdomain.com
mail.session.mail.transport.protocol=smtp
```

Don't commit the password. Supply it as an environment variable instead: Liferay reads any
portal property from a variable named `LIFERAY_` plus the property name in upper case, with each
`.` written as `_PERIOD_`.

```bash
LIFERAY_MAIL_PERIOD_SESSION_PERIOD_MAIL_PERIOD_SMTP_PERIOD_PASSWORD=your_smtp_password
```

The same pattern works for every line above, which is the usual way to configure the official
Docker image.

## Sender address

Set the default sender under **Control Panel > Instance Settings > Email > Email Sender**. The
address must be on your verified domain. Sites and portlets that set their own sender need the same.

## Test it

Use **Forgot Password** on the sign-in page, or add a user with a real address. If nothing arrives,
look in the Liferay log for `javax.mail` or `jakarta.mail` exceptions. They include the SMTP reply
from Elastic Email.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Liferay: Connecting to a mail server](https://learn.liferay.com/w/dxp/system-administration/configuring-liferay/configuring-mail)
- [All SMTP integrations](../README.md)

## License

MIT
