# Send Email from Nodemailer with SMTP - Elastic Email

Send email from Node.js with [Nodemailer](https://nodemailer.com) and the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. One `createTransport()` call
configures it. Anything that already uses Nodemailer (Express apps, NestJS, background workers,
Auth.js) switches providers by changing the transport options.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).
> Prefer the REST API? The [Node.js examples](../../nodejs-elasticemail-examples/) use the official TypeScript SDK for templates, scheduling and batch sends.

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Setup

```bash
npm install nodemailer dotenv
cp ../.env.example .env   # then fill in the SMTP username, password, EMAIL_FROM and EMAIL_TO
```

## Send

```js
// send.mjs
import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.ELASTICEMAIL_SMTP_HOST ?? "smtp.elasticemail.com",
  port: Number(process.env.ELASTICEMAIL_SMTP_PORT ?? 2525),
  secure: false, // true only for port 465; 2525 and 587 upgrade with STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.ELASTICEMAIL_SMTP_USERNAME,
    pass: process.env.ELASTICEMAIL_SMTP_PASSWORD,
  },
});

try {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
    subject: "Hello from Nodemailer",
    text: "It works. This message went through Elastic Email SMTP.",
    html: "<p>It works. This message went through <strong>Elastic Email SMTP</strong>.</p>",
  });
  console.log("Accepted:", info.accepted, "Message-ID:", info.messageId);
} catch (err) {
  console.error("Send failed:", err.responseCode ?? "", err.response ?? err.message);
  process.exitCode = 1;
}
```

```bash
node send.mjs
```

Check the connection and credentials without sending anything:

```js
await transporter.verify(); // throws on a bad host, port or password
```

## TypeScript

```bash
npm install nodemailer && npm install -D @types/nodemailer
```

The code above works unchanged in a `.ts` file. `createTransport` returns a typed `Transporter`.

## Notes

- `secure: true` means TLS from the first byte and only works on port 465. Setting it on 2525 or
  587 fails with a TLS handshake error. `requireTLS: true` makes Nodemailer refuse to send the
  password if STARTTLS isn't available.
- Build the transporter once and reuse it. For bursts, add `pool: true` and a modest
  `maxConnections`. Elastic Email limits concurrent connections from a single IP.
- Attachments, inline images (`cid:`) and custom headers use the standard Nodemailer options. They
  need no Elastic Email-specific settings.
- `info.messageId` is the `Message-ID` header Nodemailer generated. It isn't an Elastic Email
  transaction ID, so correlate events through [webhooks](../../docs/webhooks.md) by recipient
  instead.

## AI assistant prompt

```
Send email from Node.js with Nodemailer through the Elastic Email SMTP relay.
Create one transporter with nodemailer.createTransport({ host: "smtp.elasticemail.com", port: 2525,
secure: false, requireTLS: true, auth: { user, pass } }), reading user and pass from
ELASTICEMAIL_SMTP_USERNAME and ELASTICEMAIL_SMTP_PASSWORD. The password is the SMTP password from
Elastic Email Settings > SMTP, not an API key. Never hardcode credentials. Use secure: true only
with port 465. The from address comes from EMAIL_FROM and must be on a domain verified in Elastic
Email. Always set both text and html. Log err.responseCode and err.response on failure.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Nodemailer: SMTP transport](https://nodemailer.com/smtp/)
- [Nodemailer: Message configuration](https://nodemailer.com/message/)
- [Node.js SMTP client with no dependencies](../nodejs/) - the same send, written against the protocol
- [All SMTP integrations](../README.md)

## License

MIT
