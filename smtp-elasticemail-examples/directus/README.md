# Send Email from Directus with SMTP - Elastic Email

Send Directus user invitations, password resets, and the emails your Flows send with the **Send
Email** operation through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay.
Directus reads its mail transport from `EMAIL_*` environment variables only, so the credentials
stay in your deployment's environment and never reach the database.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A self-hosted Directus instance (Docker or Node.js) and access to its environment variables
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Configure

```bash
# .env (or the environment block of your container)
EMAIL_TRANSPORT=smtp
EMAIL_FROM=no-reply@yourdomain.com
EMAIL_SMTP_HOST=smtp.elasticemail.com
EMAIL_SMTP_PORT=2525
EMAIL_SMTP_USER=you@yourdomain.com
EMAIL_SMTP_PASSWORD=your_smtp_password
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_IGNORE_TLS=false
```

| Variable | Value |
|---|---|
| `EMAIL_TRANSPORT` | `smtp` (the default is `sendmail`) |
| `EMAIL_FROM` | the sender for every system email, on your verified domain |
| `EMAIL_SMTP_SECURE` | `false` on 2525 and 587, which upgrade with STARTTLS; `true` only on 465 |
| `EMAIL_SMTP_IGNORE_TLS` | `false`, so the STARTTLS upgrade isn't skipped |

With Docker Compose, pass the password from your shell or a secrets manager instead of writing it
into `docker-compose.yml`:

```yaml
services:
  directus:
    image: directus/directus:11
    environment:
      EMAIL_TRANSPORT: smtp
      EMAIL_FROM: no-reply@yourdomain.com
      EMAIL_SMTP_HOST: smtp.elasticemail.com
      EMAIL_SMTP_PORT: 2525
      EMAIL_SMTP_USER: ${ELASTICEMAIL_SMTP_USERNAME}
      EMAIL_SMTP_PASSWORD: ${ELASTICEMAIL_SMTP_PASSWORD}
      EMAIL_SMTP_SECURE: "false"
```

Restart Directus after changing the variables.

## Test it

With `EMAIL_VERIFY_SETUP` left at its default (`true`), Directus checks the SMTP connection at
startup and logs a warning if it can't connect or authenticate. Then send a real email: in the
Data Studio, go to **User Directory**, invite a user with your own address, or use **Forgot
password** on the sign-in page.

## Notes

- The **Send Email** operation in Flows uses the same transport. Its **From** is `EMAIL_FROM`, so
  keep that on the verified domain.
- Links in invitation and reset emails are built from `PUBLIC_URL`. Set it to the address users
  reach Directus on, or the links point to `localhost`.
- `EMAIL_SMTP_POOL=true` keeps connections open between sends, which helps when a Flow sends many
  emails in a row.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Directus: Email configuration](https://directus.com/docs/configuration/email)
- [All SMTP integrations](../README.md)

## License

MIT
