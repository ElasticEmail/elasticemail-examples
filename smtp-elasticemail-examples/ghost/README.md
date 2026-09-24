# Send Email from Ghost with SMTP - Elastic Email

Send Ghost's transactional email (staff invitations, password resets, staff sign-in verification
and member sign-in links) through the [Elastic Email](https://elasticemail.com/email-api) SMTP
relay. Self-hosted Ghost reads the relay from the `mail` block of `config.production.json`, or from
`mail__*` environment variables when you run the Docker image.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A self-hosted Ghost 5 or 6 install (Ghost-CLI or Docker) with shell access
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: config.production.json (Ghost-CLI)

Add a `mail` block to `config.production.json` in your Ghost install directory:

```json
"mail": {
  "transport": "SMTP",
  "from": "'Acme' <no-reply@yourdomain.com>",
  "options": {
    "host": "smtp.elasticemail.com",
    "port": 2525,
    "secure": false,
    "auth": {
      "user": "you@yourdomain.com",
      "pass": "your_smtp_password"
    }
  }
}
```

`secure: false` on 2525 and 587 means the connection starts in plain text and upgrades with
STARTTLS. Use `"port": 465` with `"secure": true` for implicit TLS. `from` must be on your
verified domain.

Apply it:

```bash
ghost restart
```

## Option 2: Environment variables (Docker)

Ghost maps every config key to an environment variable, with `__` between the levels. This keeps
the password out of the config file:

```yaml
services:
  ghost:
    image: ghost:6
    environment:
      url: https://blog.yourdomain.com
      mail__transport: SMTP
      mail__from: "'Acme' <no-reply@yourdomain.com>"
      mail__options__host: smtp.elasticemail.com
      mail__options__port: 2525
      mail__options__secure: "false"
      mail__options__auth__user: ${ELASTICEMAIL_SMTP_USERNAME}
      mail__options__auth__pass: ${ELASTICEMAIL_SMTP_PASSWORD}
```

## Test it

In Ghost Admin, go to **Settings > Staff**, invite a new staff user with your own address, or use
**Forgot?** on the Ghost Admin sign-in page. If nothing arrives, the Ghost log (`ghost log` with
Ghost-CLI, `docker compose logs ghost` with Docker) shows the SMTP reply from Elastic Email.

## Newsletters are separate

Ghost's SMTP setting covers transactional email only. Newsletters, the bulk emails that go out
when you publish a post to members, need Ghost's bulk mail integration, and Ghost currently
supports only Mailgun for that. This relay doesn't change how newsletters are sent.

## Notes

- Ghost(Pro) sites send transactional email through Ghost's own service. This guide is for
  self-hosted installs.
- Member sign-in and sign-up links are transactional, so they go through this relay. Any sender
  address you set in Ghost Admin for member emails must also be on your verified domain.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Ghost: Configuration (mail)](https://docs.ghost.org/config/#mail)
- [Ghost: Bulk email and newsletters](https://docs.ghost.org/faq/mailgun-newsletters)
- [All SMTP integrations](../README.md)

## License

MIT
