# Send Email from Metabase with SMTP - Elastic Email

Connect Metabase to the [Elastic Email](https://elasticemail.com/email-api) SMTP relay so
dashboard subscriptions, alerts, invites and password resets reach people's inboxes. This covers
the Admin settings screen, the `MB_EMAIL_SMTP_*` environment variables for self-hosted and Docker
installs, and Metabase Cloud's custom SMTP.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- Metabase (self-hosted or Cloud) and an admin account
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: Admin settings

1. Go to **Admin > Settings > Email**.
2. Fill in:

   | Metabase field | Value |
   |---|---|
   | SMTP Host | `smtp.elasticemail.com` |
   | SMTP Port | `2525` |
   | SMTP Security | STARTTLS |
   | SMTP Username | your Elastic Email SMTP username |
   | SMTP Password | your Elastic Email SMTP password |
   | From Name | `Acme Analytics` |
   | From Address | `reports@yourdomain.com` (on your verified domain) |
   | Reply-To Address | optional |

3. Click **Send test email**, then **Save changes**.

For port 465, choose **SSL** as the security setting.

On Metabase Cloud, the custom SMTP form only accepts encrypted ports: 465 (SSL), 587 (TLS) and 2525
(STARTTLS). All three work with Elastic Email.

## Option 2: Environment variables (self-hosted)

Setting email through the environment locks the fields in the Admin UI and keeps the password out
of the application database.

```bash
docker run -d -p 3000:3000 --name metabase \
  -e MB_EMAIL_SMTP_HOST=smtp.elasticemail.com \
  -e MB_EMAIL_SMTP_PORT=2525 \
  -e MB_EMAIL_SMTP_SECURITY=starttls \
  -e MB_EMAIL_SMTP_USERNAME="$ELASTICEMAIL_SMTP_USERNAME" \
  -e MB_EMAIL_SMTP_PASSWORD="$ELASTICEMAIL_SMTP_PASSWORD" \
  -e MB_EMAIL_FROM_NAME="Acme Analytics" \
  -e MB_EMAIL_FROM_ADDRESS=reports@yourdomain.com \
  metabase/metabase
```

`MB_EMAIL_SMTP_SECURITY` accepts `none`, `ssl`, `tls` and `starttls`.

## Test it

Create a subscription on any dashboard (sharing icon > **Subscriptions** > **Email it**) and click
**Send email now**. Failures show up in **Admin > Troubleshooting > Logs**.

## Notes

- Subscription emails embed charts as images and can be large. A slow send is normal and doesn't
  mean the connection failed.
- On Pro and Enterprise plans, `MB_SUBSCRIPTION_ALLOWED_DOMAINS` restricts which recipient domains
  subscriptions can go to.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Metabase: Setting up email](https://www.metabase.com/docs/latest/configuring-metabase/email)
- [Metabase: Environment variables](https://www.metabase.com/docs/latest/configuring-metabase/environment-variables)
- [All SMTP integrations](../README.md)

## License

MIT
