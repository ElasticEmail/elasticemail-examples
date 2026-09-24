# Send Email from Discourse with SMTP - Elastic Email

Send a self-hosted Discourse forum's account activation emails, notifications, digests and
password resets through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay.
The standard Docker install keeps the relay in `containers/app.yml` as `DISCOURSE_SMTP_*`
variables, and `./discourse-setup` asks for them on a new install. SMTP is optional in recent
installers, but digests, mailing list mode and email replies need it.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Discourse forum on the official Docker install (`/var/discourse`) and root access to the server
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: New install with discourse-setup

`sudo ./discourse-setup` prompts for the hostname, admin email and SMTP settings, then writes
`containers/app.yml` and builds the container. Choose to configure SMTP rather than skip it, and
answer the mail prompts with:

| Setting | Value |
|---|---|
| SMTP server | `smtp.elasticemail.com` |
| SMTP port | `587` (or `2525`) |
| SMTP username | your Elastic Email SMTP username |
| SMTP password | your Elastic Email SMTP password |
| Notification email | `noreply@forum.yourdomain.com` (on your verified domain) |

## Option 2: Edit app.yml

On an existing forum, edit the `env:` section of `/var/discourse/containers/app.yml`:

```yaml
env:
  DISCOURSE_HOSTNAME: forum.yourdomain.com
  DISCOURSE_SMTP_ADDRESS: smtp.elasticemail.com
  DISCOURSE_SMTP_PORT: 587
  DISCOURSE_SMTP_USER_NAME: you@yourdomain.com
  ## Quote the password: a '#' in it would otherwise start a YAML comment
  DISCOURSE_SMTP_PASSWORD: "your_smtp_password"
  DISCOURSE_SMTP_ENABLE_START_TLS: true
  DISCOURSE_NOTIFICATION_EMAIL: noreply@forum.yourdomain.com
```

`DISCOURSE_NOTIFICATION_EMAIL` is the sender of every email the forum sends, so it must be on a
domain verified in Elastic Email. STARTTLS is on by default. For port 465, set
`DISCOURSE_SMTP_PORT: 465` and `DISCOURSE_SMTP_FORCE_TLS: true` instead.

Rebuild the container to apply the change:

```bash
cd /var/discourse
./launcher rebuild app
```

## Test it

Sign in as an admin, open **Admin > Email** (`/admin/email`), enter your address under **Send Test
Email** and click **Send Test Email**. From the server you can also run:

```bash
cd /var/discourse
./launcher enter app
rake emails:test[you@yourdomain.com]
```

The rake task walks through the SMTP conversation and prints the reply from Elastic Email when
something fails.

## Notes

- Discourse sends through Sidekiq. If the test works but notifications don't arrive, look under
  **Admin > Email > Sent** and **Skipped**, and check `/sidekiq` for failed jobs.
- Replying by email needs incoming email as well. That's a separate setup, and the relay here
  only handles outgoing mail.
- Opens, clicks and bounces for forum emails appear in your Elastic Email reports and fire your
  [webhooks](../../docs/webhooks.md) like any other send.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Discourse: Cloud install guide](https://github.com/discourse/discourse/blob/main/docs/INSTALL-cloud.md)
- [Discourse: Email setup for self-hosted installs](https://github.com/discourse/discourse/blob/main/docs/INSTALL-email.md)
- [Discourse Docker: sample app.yml](https://github.com/discourse/discourse_docker/blob/main/samples/standalone.yml)
- [All SMTP integrations](../README.md)

## License

MIT
