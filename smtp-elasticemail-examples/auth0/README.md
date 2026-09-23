# Send Email from Auth0 with SMTP - Elastic Email

Deliver Auth0's verification, password reset, welcome and MFA emails through the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. Auth0's built-in email provider
is only meant for testing. Switching it to a custom SMTP provider takes one form in the
dashboard, and your tenant code doesn't change.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- An Auth0 tenant and a dashboard user allowed to change branding settings
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Configure

1. In the Auth0 Dashboard, go to **Branding > Email Provider**.
2. Turn on **Use my own email provider** and choose **SMTP Provider**.
3. Fill in the form:

   | Auth0 field | Value |
   |---|---|
   | From | `hello@yourdomain.com` (on your verified domain) |
   | Host | `smtp.elasticemail.com` |
   | Port | `587` |
   | Username | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |

4. Click **Save**, then **Send Test Email**.

Auth0 needs a server that supports SMTP AUTH with LOGIN and TLS 1.2 or newer, and recommends
port 587. Elastic Email supports all three. Port 465 also works, but avoid 25: many networks block it.

## Customize the emails

Once the provider is saved, each Auth0 message is edited under **Branding > Email Templates**.
The **From** address on a template overrides the provider default. Keep it on the verified domain,
or Elastic Email rejects the message.

## Test it

Trigger a real flow instead of relying only on the test button:

- Sign up a new user with a database connection. The verification email goes out immediately.
- On the Universal Login page, click **Forgot password**.

Check **Monitoring > Logs** in Auth0 for `Failed Sending Notification` events. The event detail
contains the SMTP error returned by Elastic Email.

## Notes

- Changing the host, port or username through the Management API requires sending the password in
  the same request.
- If you need per-organization senders or custom logic, Auth0 Actions can call the Elastic Email
  REST API directly. See the [Node.js examples](../../express-elasticemail-examples/) for the SDK calls.
- Opens, clicks and bounces for these emails appear in your Elastic Email reports and fire your
  [webhooks](../../docs/webhooks.md) like any other send.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Auth0: Configure an SMTP email provider](https://auth0.com/docs/customize/email/smtp-email-providers/smtp-server)
- [Auth0: Customize email templates](https://auth0.com/docs/customize/email/email-templates)
- [All SMTP integrations](../README.md)

## License

MIT
