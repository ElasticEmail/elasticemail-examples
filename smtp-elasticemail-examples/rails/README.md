# Send Email from Rails with SMTP - Elastic Email

Configure Action Mailer to deliver through the [Elastic Email](https://elasticemail.com/email-api)
SMTP relay. Once `smtp_settings` points at Elastic Email, every mailer, Devise email and
`deliver_later` job uses it, and the mailer classes stay the same.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).
> Need templates, contacts or webhooks from code? The [Ruby examples](../../ruby-elasticemail-examples/) include a Rails app that uses the REST API gem.

## Prerequisites

- Rails 7.0+ (Ruby 3.1+)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Configure

```ruby
# config/environments/production.rb (and development.rb to test locally)
config.action_mailer.delivery_method = :smtp
config.action_mailer.raise_delivery_errors = true
config.action_mailer.smtp_settings = {
  address: ENV.fetch("ELASTICEMAIL_SMTP_HOST", "smtp.elasticemail.com"),
  port: Integer(ENV.fetch("ELASTICEMAIL_SMTP_PORT", "2525")),
  user_name: ENV.fetch("ELASTICEMAIL_SMTP_USERNAME"),
  password: ENV.fetch("ELASTICEMAIL_SMTP_PASSWORD"),
  authentication: :plain,
  enable_starttls: true # STARTTLS on 2525/587. For 465 use `tls: true` instead.
}
config.action_mailer.default_url_options = { host: "yourdomain.com", protocol: "https" }
```

Set the variables with `dotenv-rails` in development, and with your host's secret store in
production. On Rails 7.0, use `enable_starttls_auto: true` instead of `enable_starttls: true`.

If you keep secrets in encrypted credentials instead
(`bin/rails credentials:edit`), read them with `Rails.application.credentials.dig(:elasticemail, :smtp_password)`.

## A mailer with HTML and text

```bash
bin/rails generate mailer Welcome greeting
```

```ruby
# app/mailers/application_mailer.rb
class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("EMAIL_FROM") # e.g. "Acme <hello@yourdomain.com>"
  layout "mailer"
end

# app/mailers/welcome_mailer.rb
class WelcomeMailer < ApplicationMailer
  def greeting(email:, name:)
    @name = name
    mail(to: email, subject: "Welcome, #{name}")
  end
end
```

```erb
<%# app/views/welcome_mailer/greeting.html.erb %>
<p>Hi <%= @name %>, thanks for signing up.</p>
```

```erb
<%# app/views/welcome_mailer/greeting.text.erb %>
Hi <%= @name %>, thanks for signing up.
```

Rails finds both templates and sends a `multipart/alternative` message.

## Send a test

```bash
bin/rails runner 'WelcomeMailer.greeting(email: ENV.fetch("EMAIL_TO"), name: "Ada").deliver_now'
```

In the app, use `deliver_later` so the SMTP round-trip happens in Active Job, not in the request.

## Notes

- The `from` address, whether in `ApplicationMailer`, a Devise initializer (`config.mailer_sender`)
  or a single `mail(from:)`, must be on your verified domain.
- Keep `raise_delivery_errors = true` at least while setting up. With it off, a bad password fails
  silently.
- An authentication failure raises `Net::SMTPAuthenticationError` with the SMTP reply from
  Elastic Email.

## AI assistant prompt

```
Configure Rails Action Mailer to send through the Elastic Email SMTP relay. In the environment
config set delivery_method = :smtp and smtp_settings = { address: "smtp.elasticemail.com",
port: 2525, user_name:, password:, authentication: :plain, enable_starttls: true }, reading the
credentials with ENV.fetch("ELASTICEMAIL_SMTP_USERNAME") and ENV.fetch("ELASTICEMAIL_SMTP_PASSWORD").
The password is the SMTP password from Elastic Email Settings > SMTP, not an API key. Use tls: true
only with port 465. Set default from: ENV.fetch("EMAIL_FROM") in ApplicationMailer, a sender on a
domain verified in Elastic Email. Give every mailer action both .html.erb and .text.erb templates
and send with deliver_later.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Rails Guides: Action Mailer basics](https://guides.rubyonrails.org/action_mailer_basics.html)
- [Rails Guides: Action Mailer configuration](https://guides.rubyonrails.org/configuring.html#configuring-action-mailer)
- [All SMTP integrations](../README.md)

## License

MIT
