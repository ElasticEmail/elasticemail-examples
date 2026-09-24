# Send Email from Firebase Auth with SMTP - Elastic Email

Send Firebase Authentication's email address verification, password reset and email address
change messages through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay instead
of Firebase's default sender. The relay is set once per project, in the **SMTP settings** panel of
the Authentication **Templates** tab, and every template uses it.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Firebase project with Authentication enabled, and a console role that can edit Authentication settings
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Configure

1. In the [Firebase console](https://console.firebase.google.com), open your project and go to
   **Authentication**, then the **Templates** tab.
2. Select **SMTP settings** and turn on **Enable**.
3. Fill in the form:

   | Firebase field | Value |
   |---|---|
   | Sender address | `no-reply@yourdomain.com` (on your verified domain) |
   | SMTP server host | `smtp.elasticemail.com` |
   | SMTP server port | `2525` (or `587`) |
   | SMTP account username | your Elastic Email SMTP username |
   | SMTP account password | your Elastic Email SMTP password |
   | SMTP security mode | **STARTTLS** |

4. Click **Save**.

For port 465, choose **SSL** as the security mode.

Firebase has two security modes, SSL and STARTTLS, and no unencrypted option. Both work with
Elastic Email: STARTTLS on 2525, 587 or 25, SSL on 465.

## Customize the emails

Each template on the **Templates** tab (email address verification, password reset, email address
change) has its own sender name, reply-to, subject and message. Once SMTP is on, the sender
address comes from the SMTP settings. Keep it on the verified domain, or Elastic Email rejects the
message.

## Test it

Trigger a password reset from any client:

```js
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

await sendPasswordResetEmail(getAuth(), "you@yourdomain.com");
```

The message should arrive within seconds. The call succeeds as soon as Firebase queues the email,
so an SMTP failure doesn't reach your code. If nothing arrives, check the SMTP settings for a typo
and look for the message in your Elastic Email reports.

## Notes

- If you use Identity Platform with multi-tenancy, each tenant must be allowed to inherit the
  project's custom SMTP settings, or it keeps the default sender.
- If you manage projects as code, the same settings are exposed on the Identity Platform project
  config: the `sendEmail` object with `method: CUSTOM_SMTP` and an `smtp` block whose `securityMode`
  is `START_TLS` or `SSL`.
- To build the whole message yourself, generate the action link with the Admin SDK
  (`generatePasswordResetLink`, `generateEmailVerificationLink`) and send it through the Elastic
  Email REST API. See [Sending email](../../docs/sending-email.md).

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Firebase: Customize account management emails](https://support.google.com/firebase/answer/7000714)
- [Firebase: Generate email action links](https://firebase.google.com/docs/auth/admin/email-action-links)
- [Identity Platform: Config (SMTP fields)](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config)
- [All SMTP integrations](../README.md)

## License

MIT
