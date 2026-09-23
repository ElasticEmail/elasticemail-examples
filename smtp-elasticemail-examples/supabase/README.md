# Send Email from Supabase with SMTP - Elastic Email

Send Supabase Auth's sign-up confirmations, magic links, password recovery and invite emails
through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay. Supabase's built-in
mailer is only for development and only reaches team members. Custom SMTP lifts that limit, and
you configure it in the dashboard or in `supabase/config.toml`.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).
> Want full control over the email content in code? The [Supabase Edge Functions example](../../serverless-elasticemail-examples/supabase-edge-functions/) has an Auth "Send Email" hook that uses the REST API instead.

## Prerequisites

- A Supabase project (and the [Supabase CLI](https://supabase.com/docs/guides/cli) for Option 2)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: Dashboard

1. Open your project and go to **Authentication > Emails > SMTP Settings**
   ([direct link](https://supabase.com/dashboard/project/_/auth/smtp)).
2. Turn on **Enable custom SMTP** and fill in:

   | Supabase field | Value |
   |---|---|
   | Sender email | `no-reply@yourdomain.com` (on your verified domain) |
   | Sender name | `Acme` |
   | Host | `smtp.elasticemail.com` |
   | Port number | `2525` (or `587`, `465`) |
   | Username | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |

3. Click **Save**.

When you enable custom SMTP, Supabase sets a low hourly email rate limit to protect a new sender.
Raise it under **Authentication > Rate Limits** once you've tested.

## Option 2: config.toml (CLI and local development)

```toml
# supabase/config.toml
[auth.email.smtp]
enabled = true
host = "smtp.elasticemail.com"
port = 2525
user = "env(ELASTICEMAIL_SMTP_USERNAME)"
pass = "env(ELASTICEMAIL_SMTP_PASSWORD)"
admin_email = "no-reply@yourdomain.com"
sender_name = "Acme"
```

`env(...)` is read from the environment or from `supabase/.env` when the CLI starts, so the
password never lands in the repository. Apply the settings to a linked project with
`supabase config push`. Locally, `supabase start` uses them in place of Inbucket.

## Test it

```ts
const { error } = await supabase.auth.signUp({ email: "you@yourdomain.com", password: "a-strong-password" });
```

The confirmation email should arrive within seconds. If it doesn't, check **Logs > Auth** in the
dashboard. SMTP errors are logged with the reply from Elastic Email.

## Email templates

Edit the content under **Authentication > Emails > Templates**. Supabase renders the template
(`{{ .ConfirmationURL }}`, `{{ .Token }}`, ...) and hands the finished message to SMTP, so nothing
changes on the Elastic Email side.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Supabase: Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase: Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [All SMTP integrations](../README.md)

## License

MIT
