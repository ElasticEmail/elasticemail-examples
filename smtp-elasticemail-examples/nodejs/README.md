# Send Email from Node.js with SMTP - Elastic Email

Send email over the [Elastic Email](https://elasticemail.com/email-api) SMTP relay from Node.js
with no dependencies at all. [`send.mjs`](send.mjs) speaks SMTP itself: it opens a socket with
`node:net`, upgrades it with `node:tls` after STARTTLS, authenticates with AUTH LOGIN and sends a
multipart HTML and text message. Read it to see what an SMTP library does for you, or use it where
you can't install packages.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).
> For production code, use [Nodemailer](../nodemailer/) (pooling, attachments, retries) or the REST API from the [Node.js examples](../../nodejs-elasticemail-examples/).

## Prerequisites

- Node.js 20.6+ (for `--env-file`)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Run

```bash
cd smtp-elasticemail-examples/nodejs
cp ../.env.example .env   # then fill in the SMTP username, password, EMAIL_FROM and EMAIL_TO

node --env-file=.env send.mjs
```

```
Accepted: 250 OK <message id>
```

You don't need `npm install`. The script reads `ELASTICEMAIL_SMTP_HOST`, `ELASTICEMAIL_SMTP_PORT`,
`ELASTICEMAIL_SMTP_USERNAME`, `ELASTICEMAIL_SMTP_PASSWORD`, `EMAIL_FROM` and `EMAIL_TO`.

## What happens on the wire

```
S: 220 smtp.elasticemail.com ...                  greeting
C: EHLO localhost
S: 250-... 250 STARTTLS                           capabilities
C: STARTTLS
S: 220 Ready to start TLS
   -- TLS handshake: the same socket is wrapped with tls.connect({ socket }) --
C: EHLO localhost                                 capabilities again, now encrypted
C: AUTH LOGIN
S: 334 VXNlcm5hbWU6                               "Username:" in base64
C: <base64 username>
S: 334 UGFzc3dvcmQ6                               "Password:" in base64
C: <base64 password>
S: 235 Authentication successful
C: MAIL FROM:<hello@yourdomain.com>
C: RCPT TO:<you@yourdomain.com>
C: DATA
S: 354 Start mail input
C: <headers, blank line, MIME body> CRLF . CRLF
S: 250 OK
C: QUIT
```

On port 465 the connection is TLS from the first byte (`tls.connect({ host, port })`), and the
STARTTLS step is skipped. The script picks the mode from the port.

## The parts that are easy to get wrong

- **Line endings.** SMTP and MIME use `\r\n`, never a bare `\n`.
- **The socket must stay binary until TLS wraps it.** Calling `setEncoding()` on the plain socket
  corrupts the TLS handshake. The script decodes each chunk as it arrives instead.
- **Multi-line replies.** `250-` means more lines follow, and `250 ` (with a space) is the last one.
  Reading only the first line leaves the rest in the buffer and throws off every later command.
- **Dot-stuffing.** A body line that starts with `.` must be sent as `..`, or the server takes the
  single `.` as the end of the message.
- **Non-ASCII.** Headers are ASCII, so a subject or display name in another script goes out as an
  RFC 2047 encoded word (`=?UTF-8?B?...?=`). Bodies are base64 encoded, which also keeps lines under
  the 998-character limit.
- **The sender.** The address in `MAIL FROM` and in the `From:` header must be on a domain verified
  in Elastic Email.

## Notes

- The script sends one message and closes the connection. To send several, repeat
  `MAIL FROM` through the final `.` on the same connection before `QUIT`.
- There are no retries. A `4xx` reply is temporary and worth retrying later, while a `5xx` reply
  is permanent.
- Attachments are extra MIME parts. At that point a library like Nodemailer is the better choice.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [RFC 5321: Simple Mail Transfer Protocol](https://www.rfc-editor.org/rfc/rfc5321)
- [RFC 3207: SMTP over TLS (STARTTLS)](https://www.rfc-editor.org/rfc/rfc3207)
- [Node.js `tls.connect()`](https://nodejs.org/api/tls.html#tlsconnectoptions-callback)
- [All SMTP integrations](../README.md)

## License

MIT
