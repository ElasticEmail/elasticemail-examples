# Send Email from Grafana with SMTP - Elastic Email

Send Grafana's email alert notifications, user invitations, password resets and report emails
through the [Elastic Email](https://elasticemail.com/email-api) SMTP relay. Self-hosted Grafana
reads the relay from the `[smtp]` section of `grafana.ini`, or from `GF_SMTP_*` environment
variables, which is the usual choice for Docker and Kubernetes.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A self-hosted Grafana (OSS or Enterprise) and access to its configuration file or environment
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Option 1: grafana.ini

```ini
[smtp]
enabled = true
host = smtp.elasticemail.com:2525
user = you@yourdomain.com
# If the password contains # or ;, wrap it in triple quotes: """#password;"""
password = your_smtp_password
from_address = grafana@yourdomain.com
from_name = Acme Grafana
startTLS_policy = MandatoryStartTLS
```

`host` takes the host and port together. `from_address` must be on your verified domain.
`MandatoryStartTLS` makes Grafana refuse to send the password unless the STARTTLS upgrade
succeeds, which is what you want on 2525 and 587.

Restart Grafana after editing the file (for example `sudo systemctl restart grafana-server`).

## Option 2: Environment variables

Every setting maps to `GF_SMTP_` plus the key in upper case:

```bash
docker run -d -p 3000:3000 --name grafana \
  -e GF_SMTP_ENABLED=true \
  -e GF_SMTP_HOST=smtp.elasticemail.com:2525 \
  -e GF_SMTP_USER="$ELASTICEMAIL_SMTP_USERNAME" \
  -e GF_SMTP_PASSWORD="$ELASTICEMAIL_SMTP_PASSWORD" \
  -e GF_SMTP_FROM_ADDRESS=grafana@yourdomain.com \
  -e GF_SMTP_FROM_NAME="Acme Grafana" \
  -e GF_SMTP_STARTTLS_POLICY=MandatoryStartTLS \
  grafana/grafana
```

Environment variables override `grafana.ini`, so the password never has to be written to disk.

## Test it

Go to **Alerts & IRM > Alerting > Notification configuration** (**Alerting > Contact points** in
older versions) and open the **Contact points** tab. Edit or create a contact point with the
**Email** integration, enter your address under **Addresses** and click **Test**. Grafana sends a
test notification straight away.
You can also invite a user under **Administration > Users and access > Users**.

If the test fails, the Grafana server log shows the SMTP error returned by Elastic Email.

## Notes

- Grafana Cloud delivers email itself and needs no SMTP configuration. This guide is for
  self-hosted Grafana.
- Email alert notifications include rendered images only if the image renderer is set up. They
  can get large, so a slow send doesn't mean the connection failed.
- `startTLS_policy` also accepts `OpportunisticStartTLS` and `NoStartTLS`. Keep `MandatoryStartTLS`
  with Elastic Email.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Grafana: Configuration, smtp section](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#smtp)
- [Grafana: Configure email for alert notifications](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-email/)
- [All SMTP integrations](../README.md)

## License

MIT
