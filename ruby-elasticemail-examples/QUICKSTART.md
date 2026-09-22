# Send your first email with Ruby

Five minutes from a clean clone to a delivered email, using the Elastic Email Ruby SDK. Works plain,
with Sinatra or with Rails.

## Prerequisites

- Ruby 3.1+ and Bundler
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/ruby-elasticemail-examples

bundle install
cp .env.example .env
```

In a project of your own:

```ruby
# Gemfile
gem "ElasticEmail", "~> 4.2"
gem "dotenv", "~> 3.0"
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

Full list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

```ruby
require "ElasticEmail"
require "dotenv/load"

ElasticEmail.configure do |config|
  config.api_key["X-ElasticEmail-ApiKey"] = ENV.fetch("ELASTICEMAIL_API_KEY")
end

result = ElasticEmail::EmailsApi.new.emails_transactional_post(
  ElasticEmail::EmailTransactionalMessageData.new(
    recipients: ElasticEmail::TransactionalRecipient.new(to: [ENV.fetch("EMAIL_TO")]),
    content: ElasticEmail::EmailContent.new(
      from: ENV.fetch("EMAIL_FROM"),
      subject: "Hello from Elastic Email!",
      body: [
        ElasticEmail::BodyPart.new(content_type: "HTML", content: "<h1>Welcome!</h1>"),
        ElasticEmail::BodyPart.new(content_type: "PlainText", content: "Welcome!")
      ]
    )
  )
)

puts "Transaction ID: #{result.transaction_id}"
```

Ruby model attributes are snake_case throughout - `content_type`, `binary_content`, `template_name`,
`time_offset` - while the wire format is PascalCase. The SDK translates.

Run the version in this repository:

```bash
ruby examples/basic_send.rb
```

`examples/ee.rb` loads `.env`, configures the SDK and exits early with a clear message when
`ELASTICEMAIL_API_KEY` is missing.

## 6. Or run a web app

```bash
ruby sinatra_app/app.rb                       # Sinatra, http://localhost:3000
cd rails_app && bundle exec rails server -p 3000   # Rails
```

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Ruby!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## Handling failures

```ruby
rescue ElasticEmail::ApiError => e
  e.code           # HTTP status
  e.response_body  # {"Error": "..."}
```

See [Error handling](../docs/error-handling.md).

## Next steps

```bash
ruby examples/batch_send.rb            # one call, personalized per recipient
ruby examples/with_attachments.rb      # base64 file attachment
ruby examples/with_cid_attachments.rb  # inline image via cid:
ruby examples/with_template.rb         # hosted template + merge values
ruby examples/webhooks.rb              # create, list, delete a webhook
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every script and route | [README.md](README.md) |
