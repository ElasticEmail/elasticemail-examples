# Send Email from Payload CMS with SMTP - Elastic Email

Send Payload's forgot-password and email verification messages, and anything you send with
`payload.sendEmail()`, through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay.
Payload 3 has no email transport until you add an adapter. The Nodemailer adapter goes in the
`email` property of `payload.config.ts` and reads the credentials from the environment.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Payload 3 project (Next.js)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Install the adapter

```bash
pnpm add @payloadcms/email-nodemailer   # or npm install / yarn add
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

```ts
// payload.config.ts
import { buildConfig } from "payload";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";

export default buildConfig({
  // ...collections, db, secret
  email: nodemailerAdapter({
    defaultFromAddress: process.env.EMAIL_FROM!,
    defaultFromName: "Acme",
    transportOptions: {
      host: process.env.ELASTICEMAIL_SMTP_HOST ?? "smtp.elasticemail.com",
      port: Number(process.env.ELASTICEMAIL_SMTP_PORT ?? 2525),
      secure: false, // true only for port 465; 2525 and 587 upgrade with STARTTLS
      requireTLS: true,
      auth: {
        user: process.env.ELASTICEMAIL_SMTP_USERNAME,
        pass: process.env.ELASTICEMAIL_SMTP_PASSWORD,
      },
    },
  }),
});
```

`transportOptions` are [Nodemailer SMTP options](../nodemailer/), passed straight to
`createTransport()`. `defaultFromAddress` must be on your verified domain.

The adapter verifies the SMTP connection when Payload starts, so a wrong password or blocked port
shows up in the server log right away as `Error verifying Nodemailer transport.` Set `skipVerify: true` to turn that check off, for example in
CI where the relay isn't reachable.

## Test it

Use **Forgot password?** on the admin sign-in page (`/admin/login`), or send from server code such
as a route handler or a hook:

```ts
await payload.sendEmail({
  to: "you@yourdomain.com",
  subject: "Hello from Payload",
  text: "It works. This message went through Elastic Email SMTP.",
  html: "<p>It works. This message went through <strong>Elastic Email SMTP</strong>.</p>",
});
```

A failed send throws, and the error contains the SMTP reply from Elastic Email.

## Notes

- Without an `email` adapter, Payload logs a warning at startup and on every send attempt, and
  nothing is delivered.
- Verification emails go out for collections with `auth: { verify: true }`. Customize them with
  `auth.verify.generateEmailHTML` and `generateEmailSubject`, and the reset email with
  `auth.forgotPassword.generateEmailHTML`.
- For templates, merge fields or scheduling, call the Elastic Email REST API from a Payload hook
  instead. See the [Next.js examples](../../nextjs-elasticemail-examples/).

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Payload: Email functionality](https://payloadcms.com/docs/email/overview)
- [Payload: Authentication emails](https://payloadcms.com/docs/authentication/email)
- [All SMTP integrations](../README.md)

## License

MIT
