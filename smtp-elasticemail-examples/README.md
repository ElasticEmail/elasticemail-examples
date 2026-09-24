# SMTP Email Examples - Elastic Email

Send email through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay from the
tools and frameworks that already speak SMTP. Point Auth0, Supabase Auth, Keycloak, WordPress, Ghost,
Grafana, GitLab or n8n at `smtp.elasticemail.com`, or hand the same settings to Nodemailer, PHPMailer, Django,
Laravel, Rails or Auth.js. There is also a plain Node.js client with no dependencies. You don't need an SDK or any code beyond each tool's own mail
configuration.

Every other folder in this repository uses the REST API v4 through the official SDKs. Use SMTP
when a tool only lets you configure an SMTP server, or when an app already sends through its
framework's mailer and you want to swap the provider without touching the send code.

> **First time here?** The [SMTP quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind the examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials, created in the dashboard under Settings > SMTP > Create SMTP Credentials ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))
- The tool or framework you want to connect

## SMTP settings

The same values work in every integration below.

| Setting | Value |
|---|---|
| Host | `smtp.elasticemail.com` |
| Port | `2525` (recommended), `587` or `25` with STARTTLS; `465` with implicit TLS (SSL) |
| Username | the username shown on your SMTP credentials; by default, the email address you log in with |
| Password | the SMTP password generated with the credentials, shown once |
| Authentication | on (LOGIN / PLAIN) |
| Sender (`From`) | any address on a domain verified in Elastic Email |

Some hosting providers block port 25, and some block 2525 as well. If the connection times out,
try 587, then 465.

## Integrations

### Platforms: paste the settings into a dashboard or config file

| Folder | Where the settings go | What it sends |
|---|---|---|
| [appwrite](appwrite/) | `_APP_SMTP_*` env vars (self-hosted), or project Settings > SMTP | Verification, password recovery, magic URL, OTP and team invite emails |
| [auth0](auth0/) | Branding > Email Provider > SMTP Provider | Verification, password reset, welcome and MFA emails |
| [customer-io](customer-io/) | Workspace Settings > Messaging > Email > Custom SMTP | Campaign, broadcast and transactional messages |
| [directus](directus/) | `EMAIL_TRANSPORT=smtp` and `EMAIL_SMTP_*` env vars | User invites, password resets, Flows "Send Email" operation |
| [discourse](discourse/) | `DISCOURSE_SMTP_*` in `containers/app.yml`, or `./discourse-setup` | Account activation, notifications, digests, password resets |
| [firebase-auth](firebase-auth/) | Authentication > Templates > SMTP settings | Email verification, password reset, email change emails |
| [ghost](ghost/) | `mail` block in `config.production.json`, or `mail__*` env vars | Staff invites, password resets, member sign-in links (not newsletters) |
| [gitlab](gitlab/) | `gitlab_rails['smtp_*']` in `/etc/gitlab/gitlab.rb` | Notifications, confirmations, password resets |
| [grafana](grafana/) | `[smtp]` in `grafana.ini`, or `GF_SMTP_*` env vars | Alert notifications, invites, password resets, reports |
| [keycloak](keycloak/) | Realm settings > Email, or `kcadm.sh update realms/...` | Email verification, password reset, required-action and event emails |
| [liferay](liferay/) | Control Panel > Server Administration > Mail | Portal notifications, password resets, workflow emails |
| [metabase](metabase/) | Admin > Settings > Email | Dashboard subscriptions, alerts, invites |
| [n8n](n8n/) | SMTP credential in the Send Email node; `N8N_SMTP_*` env vars | Workflow emails; user invites and password resets (self-hosted) |
| [nextcloud](nextcloud/) | Administration settings > Basic settings > Email server, or `occ config:system:set mail_*` | Share notifications, password resets, activity emails |
| [payload](payload/) | `nodemailerAdapter` in `payload.config.ts` | Forgot-password, verification and `payload.sendEmail()` emails |
| [pocketbase](pocketbase/) | Settings > Mail settings, or `app.settings().smtp` in a migration | Verification, password reset, email change, OTP, login alerts |
| [retool](retool/) | Resources > Create new > SMTP | Emails sent from Retool apps and workflows |
| [strapi](strapi/) | `@strapi/provider-email-nodemailer` in `config/plugins.js` | Account confirmation, password reset, `email` plugin sends |
| [supabase](supabase/) | Authentication > Emails > SMTP Settings, or `config.toml` | Sign-up confirmation, magic link, recovery, invite emails |
| [wordpress](wordpress/) | WP Mail SMTP plugin, or constants in `wp-config.php` | Everything `wp_mail()` sends: WooCommerce, forms, password resets |
| [zapier](zapier/) | SMTP by Zapier app, Send Email action | Emails sent from Zaps |

### Code: configure the framework's mailer

| Folder | Language | Library or setting |
|---|---|---|
| [nodejs](nodejs/) | Node.js | `node:net` and `node:tls` only, no dependencies |
| [nodemailer](nodemailer/) | Node.js | `nodemailer.createTransport()` |
| [nextauth](nextauth/) | Next.js | Auth.js Nodemailer provider (magic links) |
| [phpmailer](phpmailer/) | PHP | `PHPMailer` with `isSMTP()` |
| [laravel](laravel/) | PHP | `MAIL_*` variables and the `smtp` mailer |
| [django](django/) | Python | `EMAIL_BACKEND` and `EMAIL_*` settings |
| [rails](rails/) | Ruby | `config.action_mailer.smtp_settings` |

## Environment variables

The code examples read these variables. Framework integrations map them onto the framework's own
names (`MAIL_*` in Laravel, `EMAIL_*` in Django), and each README shows how.

```
ELASTICEMAIL_SMTP_HOST      smtp.elasticemail.com
ELASTICEMAIL_SMTP_PORT      2525
ELASTICEMAIL_SMTP_USERNAME  SMTP username from the dashboard
ELASTICEMAIL_SMTP_PASSWORD  SMTP password from the dashboard (not the API key)
EMAIL_FROM                  verified sender, e.g. Acme <hello@yourdomain.com>
EMAIL_TO                    test recipient
```

Copy [`.env.example`](.env.example) to `.env` in your project. Platform integrations store the
values in the platform's own settings, not in a file.

## SMTP or the REST API?

| | SMTP relay | REST API v4 |
|---|---|---|
| Works with | anything that has an SMTP setting | code that can make HTTPS requests |
| Credentials | SMTP username and password | API key |
| Response | `250 OK` from the server | `TransactionID` and `MessageID` to look up later |
| Templates, merge fields, scheduling | build the message yourself | built in ([Sending email](../docs/sending-email.md), [Templates](../docs/templates.md)) |
| Webhooks, suppressions, statistics | same as the API: they are account-level | same |

Mail sent over SMTP shows up in the same reports and fires the same [webhooks](../docs/webhooks.md)
as mail sent through the API. If you already use one of the frameworks above and want the API
instead, the [Laravel](../laravel-elasticemail-examples/), [Python](../python-elasticemail-examples/)
(Django), [Ruby](../ruby-elasticemail-examples/) (Rails), [Next.js](../nextjs-elasticemail-examples/),
[Node.js](../nodejs-elasticemail-examples/) and
[Supabase Edge Functions](../serverless-elasticemail-examples/supabase-edge-functions/) folders have
full SDK examples.

## Troubleshooting

**`535 Authentication failed`**
The username or password is wrong. The password is the SMTP password generated with the
credentials, not your account password and not an API key. If you lost it, create new credentials.

**Connection timeout**
The port is blocked on your network or host. Try 2525, 587 and 465 in that order.

**Sender rejected, or the send succeeds but nothing arrives**
The `From` address is not on a verified domain. See
[Domains and deliverability](../docs/domains-and-deliverability.md).

**TLS or certificate errors on 465**
Port 465 expects TLS from the first byte (`secure: true`, `ssl`, `smtps`). Ports 2525, 587 and 25
start in plain text and upgrade with STARTTLS. Mixing the two is the usual cause.

More symptoms: [Troubleshooting](../docs/troubleshooting.md#smtp).

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email Developers](https://elasticemail.com/developers)
- [Plans and pricing](https://elasticemail.com/email-api-pricing)
- [Dashboard](https://app.elasticemail.com)

## License

MIT
