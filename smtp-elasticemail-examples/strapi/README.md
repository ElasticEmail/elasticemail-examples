# Send Email from Strapi with SMTP - Elastic Email

Send Strapi's account confirmation and password reset emails, and anything your code sends with
`strapi.plugin('email').service('email').send()`, through the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. Strapi's Email feature uses the
local `sendmail` provider by default. Swap it for the Nodemailer provider in `config/plugins.js`
(or `.ts`) and read the credentials from the environment.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Strapi 5 project (Strapi 4 uses the same configuration, with the provider version that matches your Strapi major)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Install the provider

```bash
npm install @strapi/provider-email-nodemailer
```

## Configure

```bash
# .env
ELASTICEMAIL_SMTP_HOST=smtp.elasticemail.com
ELASTICEMAIL_SMTP_PORT=2525
ELASTICEMAIL_SMTP_USERNAME=you@yourdomain.com
ELASTICEMAIL_SMTP_PASSWORD=your_smtp_password
EMAIL_FROM=no-reply@yourdomain.com
```

```js
// config/plugins.js
module.exports = ({ env }) => ({
  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        host: env("ELASTICEMAIL_SMTP_HOST", "smtp.elasticemail.com"),
        port: env.int("ELASTICEMAIL_SMTP_PORT", 2525),
        secure: false, // true only for port 465; 2525 and 587 upgrade with STARTTLS
        requireTLS: true,
        auth: {
          user: env("ELASTICEMAIL_SMTP_USERNAME"),
          pass: env("ELASTICEMAIL_SMTP_PASSWORD"),
        },
      },
      settings: {
        defaultFrom: env("EMAIL_FROM"),
        defaultReplyTo: env("EMAIL_FROM"),
      },
    },
  },
});
```

In a TypeScript project, put the same object in `config/plugins.ts` with
`export default ({ env }) => ({ ... })`. `providerOptions` goes straight to
`nodemailer.createTransport()`, so any [Nodemailer SMTP option](../nodemailer/) works here.

`defaultFrom` is the sender when a call doesn't pass `from`. It, and any `from` you pass, must be on
your verified domain. Restart Strapi after changing the configuration.

## Test it

In the admin panel, go to **Settings > Email feature > Configuration**. Enter an address under
**Test email delivery** and click **Send test email**.

Or send from code, for example in a controller or `src/index.js` bootstrap:

```js
await strapi.plugin("email").service("email").send({
  to: "you@yourdomain.com",
  subject: "Hello from Strapi",
  text: "It works. This message went through Elastic Email SMTP.",
  html: "<p>It works. This message went through <strong>Elastic Email SMTP</strong>.</p>",
});
```

A failed send throws, and the error message contains the SMTP reply from Elastic Email.

## Notes

- The Users & Permissions plugin's confirmation and reset password emails have their own sender
  name and address under **Settings > Users & Permissions plugin > Email templates**. Change the
  shipped `no-reply@strapi.io` to an address on your verified domain.
- Strapi Cloud comes with a basic email provider. To use Elastic Email there, put the
  configuration above in `config/env/production/plugins.js` (that exact path) and add the
  `ELASTICEMAIL_SMTP_*` and `EMAIL_FROM` variables under **Settings > Variables** in the Strapi
  Cloud dashboard.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Strapi: Email feature](https://docs.strapi.io/cms/features/email)
- [Strapi: Advanced Nodemailer configuration](https://docs.strapi.io/cms/configurations/email-nodemailer)
- [All SMTP integrations](../README.md)

## License

MIT
