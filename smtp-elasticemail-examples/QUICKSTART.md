# Send your first email with SMTP

Five minutes from nothing to a delivered email over the Elastic Email SMTP relay. The first send
uses `curl`, which speaks SMTP and is already installed on macOS, Linux and Windows 10+. Once that
works, the same four settings go into whatever tool you're connecting.

## Prerequisites

- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain
- `curl` 7.20 or newer (`curl --version`)

## 1. Create SMTP credentials

In the dashboard, open Settings > SMTP and click Create SMTP Credentials. The username defaults to
the email address you log in with. Copy the password straight away. You can't read it again
after you close the window.

The fields and ports are described in [SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain, over SMTP just as over the API.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Send with curl

```bash
export ELASTICEMAIL_SMTP_USERNAME="you@yourdomain.com"
export ELASTICEMAIL_SMTP_PASSWORD="your_smtp_password"
export EMAIL_FROM="hello@yourdomain.com"
export EMAIL_TO="you@yourdomain.com"

cat > message.txt <<EOF
From: Acme <$EMAIL_FROM>
To: $EMAIL_TO
Subject: Hello from Elastic Email SMTP
Content-Type: text/plain; charset=utf-8

It works. This message went through smtp.elasticemail.com.
EOF

curl --url "smtp://smtp.elasticemail.com:2525" --ssl-reqd \
  --user "$ELASTICEMAIL_SMTP_USERNAME:$ELASTICEMAIL_SMTP_PASSWORD" \
  --mail-from "$EMAIL_FROM" --mail-rcpt "$EMAIL_TO" \
  --upload-file message.txt
```

No output means the server accepted the message. Add `-v` to watch the SMTP conversation: look
for `235 Authentication successful` and a `250` after the message body.

`--ssl-reqd` makes curl upgrade the connection with STARTTLS before it sends the password. For
port 465, use `smtps://smtp.elasticemail.com:465` instead.

## 4. The four settings, everywhere else

| Setting | Value |
|---|---|
| Host | `smtp.elasticemail.com` |
| Port | `2525`, `587` or `25` with STARTTLS, `465` with implicit TLS |
| Username | your SMTP username |
| Password | your SMTP password |

## 5. Pick an integration

| You want to send from | Read |
|---|---|
| Auth0, Supabase Auth or Auth.js login emails | [auth0](auth0/), [supabase](supabase/), [nextauth](nextauth/) |
| A WordPress site | [wordpress](wordpress/) |
| Metabase, Retool or Liferay | [metabase](metabase/), [retool](retool/), [liferay](liferay/) |
| Customer.io campaigns | [customer-io](customer-io/) |
| Your own Node.js or PHP code | [nodejs](nodejs/) (no dependencies), [nodemailer](nodemailer/), [phpmailer](phpmailer/) |
| A Laravel, Django or Rails app | [laravel](laravel/), [django](django/), [rails](rails/) |

## Next steps

| Do this | Read |
|---|---|
| Get told about opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Understand SPF, DKIM and DMARC | [Domains and deliverability](../docs/domains-and-deliverability.md) |
| Fix a failing connection | [Troubleshooting](../docs/troubleshooting.md#smtp) |
| Use templates, merge fields or scheduling | [Send with the REST API](../README.md#all-stacks) |
