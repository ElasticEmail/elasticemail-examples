# Send Email from GitLab with SMTP - Elastic Email

Send a self-managed GitLab's notification emails (merge requests, issues, pipeline failures,
mentions), account confirmations and password resets through the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. On a Linux package (Omnibus)
install, the settings go in `/etc/gitlab/gitlab.rb` and take effect after `gitlab-ctl reconfigure`.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).

## Prerequisites

- A self-managed GitLab installed with the Linux package (Omnibus), and root access to the server
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Configure

```ruby
# /etc/gitlab/gitlab.rb
gitlab_rails['smtp_enable'] = true
gitlab_rails['smtp_address'] = "smtp.elasticemail.com"
gitlab_rails['smtp_port'] = 2525
gitlab_rails['smtp_user_name'] = "you@yourdomain.com"
gitlab_rails['smtp_password'] = "your_smtp_password"
gitlab_rails['smtp_domain'] = "yourdomain.com"
gitlab_rails['smtp_authentication'] = "login"
gitlab_rails['smtp_enable_starttls_auto'] = true
gitlab_rails['smtp_tls'] = false
gitlab_rails['smtp_openssl_verify_mode'] = 'peer'

gitlab_rails['gitlab_email_from'] = 'gitlab@yourdomain.com'
gitlab_rails['gitlab_email_display_name'] = 'Acme GitLab'
gitlab_rails['gitlab_email_reply_to'] = 'noreply@yourdomain.com'
```

`gitlab_email_from` must be on your verified domain. For port 465, set `smtp_port` to `465`,
`smtp_tls` to `true` and `smtp_enable_starttls_auto` to `false`.

Apply the change:

```bash
sudo gitlab-ctl reconfigure
```

## Keep the password out of gitlab.rb

GitLab can store the SMTP username and password in an encrypted file instead:

```bash
sudo gitlab-rake gitlab:smtp:secret:edit EDITOR=vim
```

```yaml
user_name: 'you@yourdomain.com'
password: 'your_smtp_password'
```

Then remove `smtp_user_name` and `smtp_password` from `gitlab.rb` and run
`sudo gitlab-ctl reconfigure` again.

## Test it

```bash
sudo gitlab-rails console
```

```ruby
Notify.test_email('you@yourdomain.com', 'Hello from GitLab', 'It works. This message went through Elastic Email SMTP.').deliver_now
```

An exception here carries the SMTP reply from Elastic Email, for example
`Net::SMTPAuthenticationError: 535` for a wrong password. `ActionMailer::Base.smtp_settings` in the
same console shows the settings GitLab actually loaded.

## Notes

- For the Docker image, put the same lines in the `GITLAB_OMNIBUS_CONFIG` environment variable.
  With the Helm chart, the values live under `global.smtp` and `global.email` instead.
- Busy instances can reuse connections with `gitlab_rails['smtp_pool'] = true`.
- Incoming email (reply by email, Service Desk) is a separate feature and doesn't use this setting.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [GitLab: SMTP settings (Linux package)](https://docs.gitlab.com/omnibus/settings/smtp/)
- [GitLab: Encrypted SMTP credentials](https://docs.gitlab.com/omnibus/settings/smtp/#using-encrypted-credentials)
- [All SMTP integrations](../README.md)

## License

MIT
