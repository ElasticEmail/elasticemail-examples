# Send Email from n8n with SMTP - Elastic Email

Send email from n8n workflows with the **Send Email** node and an SMTP credential pointed at the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. On a self-hosted instance, the same
relay can also deliver n8n's own user invitations and password resets, which read `N8N_SMTP_*`
environment variables instead of a credential.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- n8n Cloud or a self-hosted n8n instance (plus access to its environment for the second section)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Workflow emails: SMTP credential

1. In n8n, create a credential of type **SMTP** (from **Credentials**, or from the credential
   dropdown of a **Send Email** node).
2. Fill in:

   | n8n field | Value |
   |---|---|
   | User | your Elastic Email SMTP username |
   | Password | your Elastic Email SMTP password |
   | Host | `smtp.elasticemail.com` |
   | Port | `2525` (or `587`) |
   | SSL/TLS | off |
   | Disable STARTTLS | off |
   | Client Host Name | leave empty |

3. Save the credential.

**SSL/TLS** off with **Disable STARTTLS** off means the connection upgrades with STARTTLS, which is
what 2525 and 587 expect. For port 465, turn **SSL/TLS** on.

## Add a Send Email node

| Parameter | Value |
|---|---|
| Credential to connect with | the SMTP credential above |
| Operation | Send |
| From Email | `Acme <hello@yourdomain.com>` (on your verified domain) |
| To Email | `{{ $json.email }}` or a fixed address |
| Subject | your subject line |
| Email Format | **Both**, then fill in **Text** and **HTML** |

Click **Execute step** (**Test step** in older versions) to send one message. If Elastic Email
rejects it, the node's error output contains the SMTP reply.

## n8n's own emails (self-hosted)

Invitations and password resets for n8n users don't use credentials. Set these variables on the
n8n process or container:

```bash
N8N_EMAIL_MODE=smtp
N8N_SMTP_HOST=smtp.elasticemail.com
N8N_SMTP_PORT=2525
N8N_SMTP_USER=you@yourdomain.com
N8N_SMTP_PASS=your_smtp_password
N8N_SMTP_SENDER="Acme n8n <n8n@yourdomain.com>"
N8N_SMTP_SSL=false
N8N_SMTP_STARTTLS=true
```

`N8N_SMTP_SSL` defaults to `true`, which is implicit TLS and only works on port 465. Set it to
`false` on 2525 and 587 and leave `N8N_SMTP_STARTTLS` on. Restart n8n, then invite a user under
**Settings > Users** to test.

## Templates and merge fields: use the REST API

The Send Email node sends one finished message per item. To use Elastic Email templates, merge
fields, scheduling or a single bulk call for many recipients, call the REST API with an **HTTP
Request** node instead:

| Parameter | Value |
|---|---|
| Method | POST |
| URL | `https://api.elasticemail.com/v4/emails/transactional` |
| Header | `X-ElasticEmail-ApiKey`: your API key (store it as a Header Auth credential) |
| Body | JSON with `Recipients` and `Content`, as in [Sending email](../../docs/sending-email.md) |

## Notes

- The node sends one email per input item. For large lists, add a **Loop Over Items** node with a
  modest batch size, or use the API's bulk endpoint (`POST /emails`).
- On n8n Cloud, n8n delivers its own account emails, so you only need the SMTP credential for
  workflow emails.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [n8n: Send Email node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.sendemail/)
- [n8n: SMTP credentials](https://docs.n8n.io/integrations/builtin/credentials/send-email/)
- [n8n: User management SMTP variables](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/user-management-and-2fa/)
- [All SMTP integrations](../README.md)

## License

MIT
