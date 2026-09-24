# Send Email from Keycloak with SMTP - Elastic Email

Deliver Keycloak's email verification, password reset, "update your account" and admin event
emails through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay. Keycloak keeps
the SMTP settings per realm, on the **Email** tab of the realm settings. You can fill them in the
admin console or set them from a script with `kcadm.sh`.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Keycloak server and an admin account with the `manage-realm` role on the realm you configure
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: Admin console

1. Select the realm, then open **Realm settings** and the **Email** tab.
2. Fill in the **Template** section:

   | Keycloak field | Value |
   |---|---|
   | From | `no-reply@yourdomain.com` (on your verified domain) |
   | From display name | `Acme` |
   | Reply to | optional |
   | Envelope from | leave empty |

3. Fill in **Connection & Authentication**:

   | Keycloak field | Value |
   |---|---|
   | Host | `smtp.elasticemail.com` |
   | Port | `2525` (or `587`) |
   | Encryption | tick **Enable StartTLS**, leave **Enable SSL** off |
   | Authentication | on |
   | Username | your Elastic Email SMTP username |
   | Authentication Type | password |
   | Password | your Elastic Email SMTP password |

4. Click **Save**.

For port 465, tick **Enable SSL** instead of **Enable StartTLS**.

The master realm and each application realm have their own Email tab. Configure every realm whose
users should get email.

## Option 2: kcadm.sh

The admin CLI writes the same `smtpServer` settings, which is handy for provisioning scripts and
containers. Read the password from the environment so it never lands in shell history:

```bash
export ELASTICEMAIL_SMTP_USERNAME="you@yourdomain.com"
export ELASTICEMAIL_SMTP_PASSWORD="your_smtp_password"

kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin

kcadm.sh update realms/myrealm \
  -s 'smtpServer.host=smtp.elasticemail.com' \
  -s 'smtpServer.port=2525' \
  -s 'smtpServer.starttls=true' \
  -s 'smtpServer.ssl=false' \
  -s 'smtpServer.auth=true' \
  -s "smtpServer.user=$ELASTICEMAIL_SMTP_USERNAME" \
  -s "smtpServer.password=$ELASTICEMAIL_SMTP_PASSWORD" \
  -s 'smtpServer.from=no-reply@yourdomain.com' \
  -s 'smtpServer.fromDisplayName=Acme'
```

Replace `myrealm` with your realm name. The **Password** field can also point to a value in a
Keycloak vault, for example `${vault.smtp_password}`, if you have a vault provider configured.

## Test it

Keycloak sends the test message to the email address of the admin who is signed in. If your admin
user has no email address, the Email tab tells you to add one first. Then click **Test connection**.
A green "SMTP connection successful. E-mail was sent!" alert means Elastic Email accepted the message.

To try a real flow, turn on **Forgot password** and **Verify email** under **Realm settings >
Login**, then use the **Forgot Password?** link on the realm's sign-in page.

## Notes

- If **Test connection** fails, the error alert includes the SMTP reply. `535` means the username or
  password is wrong. A timeout means the port is blocked: try 2525, 587 and 465 in that order.
- Email content comes from the realm's email theme. Customize the templates in a theme, not in
  Elastic Email.
- Opens, clicks and bounces for these emails appear in your Elastic Email reports and fire your
  [webhooks](../../docs/webhooks.md) like any other send.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Keycloak: Configuring email for a realm](https://www.keycloak.org/docs/latest/server_admin/index.html#_email)
- [Keycloak: Admin CLI](https://www.keycloak.org/docs/latest/server_admin/index.html#admin-cli)
- [All SMTP integrations](../README.md)

## License

MIT
