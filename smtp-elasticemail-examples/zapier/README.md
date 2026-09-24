# Send Email from Zapier with SMTP - Elastic Email

Send email from a Zap through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay
with the built-in **SMTP by Zapier** app. Its **Send Email** action takes a subject, a plain-text
body and an optional HTML body. You connect Elastic Email once, as an SMTP account, and every Zap
can reuse that connection.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Zapier account and a Zap to add the email step to
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Connect Elastic Email

1. In a Zap, add an action step, choose **SMTP by Zapier** and the **Send Email** event.
2. Under **Account**, connect a new account and fill in:

   | Zapier field | Value |
   |---|---|
   | Host | `smtp.elasticemail.com` |
   | Username | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |
   | Use TLS | Yes |
   | Port | `587` (or `2525`) |
   | From Email | `hello@yourdomain.com` (on your verified domain) |

3. Save the connection. Zapier signs in to the server before it saves the account, so a wrong
   password or blocked port shows up here.

Zapier's help says its encrypted SMTP connections use STARTTLS, so pair **Use TLS** with 587 or
2525. Port 465 expects TLS from the first byte and may not connect. If the connection times out,
switch between 587 and 2525. If Zapier has trouble connecting, its help suggests filling in
**From Email**, which is why it's in the table.

## Configure the action

| Field | Value |
|---|---|
| From Name | `Acme` |
| From Email | `hello@yourdomain.com` (on your verified domain) |
| Reply To | optional |
| To | a fixed address, or a field mapped from the trigger |
| Subject | your subject line |
| Body | the plain-text version |
| HTML Body | the HTML version |

Fill in both **Body** and **HTML Body**, so clients that don't render HTML still get a readable
message. Click **Test step** to send one email. If it fails, the error in the test result
includes the SMTP reply from Elastic Email.

## Alternative: Webhooks by Zapier and the REST API

To use Elastic Email templates, merge fields or scheduling, call the REST API directly with a
**Webhooks by Zapier** action (**Custom Request** event):

| Field | Value |
|---|---|
| Method | POST |
| URL | `https://api.elasticemail.com/v4/emails/transactional` |
| Headers | `X-ElasticEmail-ApiKey`: your API key; `Content-Type`: `application/json` |
| Data | JSON with `Recipients` and `Content`, as in [Sending email](../../docs/sending-email.md) |

The response contains `TransactionID` and `MessageID`, which later steps in the Zap can use.

## Notes

- A `550` sender error means the **From Email** isn't on a domain verified in Elastic Email.
- A `535` error means the username or password is wrong. The password is the SMTP password, not
  your Elastic Email login password and not an API key.
- Opens, clicks and bounces for these emails appear in your Elastic Email reports and fire your
  [webhooks](../../docs/webhooks.md), which can trigger other Zaps through **Webhooks by Zapier**.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Zapier: Send emails in Zaps](https://help.zapier.com/hc/en-us/articles/8496305915917-Send-emails-in-Zaps)
- [Zapier: SMTP by Zapier](https://zapier.com/apps/smtp/integrations)
- [Zapier: Webhooks by Zapier](https://zapier.com/apps/webhook/integrations)
- [All SMTP integrations](../README.md)

## License

MIT
