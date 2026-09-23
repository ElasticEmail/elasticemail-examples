# Send Email from Customer.io with SMTP - Elastic Email

Route Customer.io campaign, broadcast and transactional messages through the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. Customer.io still handles
segmentation, journeys and message content, while Elastic Email delivers each message from your
verified domain.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Customer.io workspace on a plan that includes custom SMTP, and admin access to it
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Configure

1. In Customer.io, open **Settings > Workspace Settings**, then the **Messaging** tab.
2. Under **Email**, open the **Custom SMTP** tab and click **Add Custom SMTP Server**.
3. Choose **Other SMTP** and fill in:

   | Customer.io field | Value |
   |---|---|
   | Host | `smtp.elasticemail.com` |
   | Port | `587` (or `465`) |
   | Username | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |

4. Save, and send a test message from any campaign to your own inbox.

## Sender addresses

Every **From** address used in your campaigns must be on a domain verified in Elastic Email. If
Customer.io also asks you to verify the sending domain in its own settings, do that too. The two
checks are independent.

## Tracking

Customer.io rewrites links and adds its open pixel before handing the message to SMTP, so its
metrics keep working. Elastic Email tracks the same message on its side. If both track clicks,
links are rewritten twice. That works, but you get two redirect hops. Turn off click tracking in
one of them if you only need one set of numbers.

Bounces and complaints are recorded by Elastic Email and added to its
[suppression lists](../../docs/suppressions.md). To pass them back into Customer.io, handle the
`Error` and `AbuseReport` events with a [webhook](../../docs/webhooks.md) and update the person
through the Customer.io API.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Customer.io documentation](https://docs.customer.io)
- [All SMTP integrations](../README.md)

## License

MIT
