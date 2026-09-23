# Send Email from Retool with SMTP - Elastic Email

Add the [Elastic Email](https://elasticemail.com/email-api) SMTP relay as an SMTP resource in
Retool, then send email from any app, workflow or internal tool with a query. Approvals, alerts
and customer replies go out from your own verified domain instead of Retool's shared sender.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A Retool organization and permission to create resources
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Create the resource

1. Go to **Resources > Create new** and search for **SMTP**.
2. Fill in:

   | Retool field | Value |
   |---|---|
   | Name | `Elastic Email SMTP` |
   | Host | `smtp.elasticemail.com` |
   | Port | `2525` (or `587`) |
   | Username | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |

3. Click **Test connection**, then **Create resource**.

If the form has an SSL/TLS toggle, turn it on only when you use port 465. Ports 2525 and 587
upgrade to TLS with STARTTLS on their own.

To keep the password out of the resource form, store it as a configuration variable or secret
(**Settings > Configuration variables**) and reference it as `{{ environment.variables.ELASTICEMAIL_SMTP_PASSWORD }}`.

## Send from an app

1. In an app, add a query and pick the **Elastic Email SMTP** resource.
2. Fill in the query:

   | Query field | Example |
   |---|---|
   | From email | `support@yourdomain.com` |
   | To | `{{ table1.selectedRow.email }}` |
   | Subject | `Your request {{ table1.selectedRow.id }} was approved` |
   | Body type | HTML |
   | Body | `<p>Hi {{ table1.selectedRow.name }}, your request was approved.</p>` |

3. Trigger the query from a button's **Click** event handler.

The query also accepts CC, BCC, reply-to and attachments (pass a file from a File Input component).
The same resource works as a step in Retool Workflows.

## Notes

- The **From email** must be on your verified domain. Use a different address per app if you like,
  but keep them on the same domain.
- To track what happened to a message, use [webhooks](../../docs/webhooks.md) or the Elastic Email
  dashboard. The SMTP query only reports whether the server accepted it.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Retool documentation](https://docs.retool.com)
- [All SMTP integrations](../README.md)

## License

MIT
