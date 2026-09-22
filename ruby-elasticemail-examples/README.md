# Ruby Email API Examples - Elastic Email

Send transactional and bulk email from Ruby with the [Elastic Email](https://elasticemail.com/email-api) email API. Standalone scripts plus two web applications - Sinatra and Rails - built on the official Elastic Email Ruby SDK.

> **First time here?** The [Ruby quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Ruby 3.1+
- Bundler
- An Elastic Email account with a verified sender domain
- API key from https://app.elasticemail.com/marketing/settings/new/manage-api

## Installation

```bash
# Install dependencies
bundle install

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

## Standalone Examples

Run every script from this folder. All scripts load `examples/ee.rb`, which reads `.env`,
configures the SDK and exits early when `ELASTICEMAIL_API_KEY` is missing.

### Basic Email Sending
```bash
ruby examples/basic_send.rb
```

### Batch Sending
```bash
ruby examples/batch_send.rb
```

### With Attachments
```bash
ruby examples/with_attachments.rb
```

### With CID (Inline) Attachments
```bash
ruby examples/with_cid_attachments.rb
```

### Using Templates
```bash
ruby examples/with_template.rb
```

### Scheduled Sending
```bash
ruby examples/scheduled_send.rb
```

### Prevent Gmail Threading
```bash
ruby examples/prevent_threading.rb
```

### Contacts and Lists
```bash
ruby examples/contacts.rb
```

### Domain Management
```bash
ruby examples/domains.rb
```

### Email Status
```bash
ruby examples/email_status.rb <transactionId> [messageId]
```

### Webhooks
```bash
ruby examples/webhooks.rb
```

### Inbound Routes
```bash
ruby examples/inbound.rb
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
ruby examples/double_optin/subscribe.rb user@example.com "John Doe"

# Click-tracking based confirmation server
ruby examples/double_optin/webhook.rb
```

### Suppressions
```bash
ruby examples/suppressions.rb [email]
```

### Email Verification
```bash
ruby examples/email_verification.rb someone@example.com
```

### Statistics
```bash
ruby examples/statistics.rb
```

### Sub-Accounts
```bash
ruby examples/sub_accounts.rb
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true ruby examples/sub_accounts.rb
```

## Sinatra Application

```bash
ruby sinatra_app/app.rb

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Sinatra!"}'
```

## Rails Application

```bash
cd rails_app
bundle install
bundle exec rails server -p 3000

curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Rails!"}'
```

See [rails_app/README.md](rails_app/README.md) for details.

## API Endpoints

Both server apps expose the same routes and JSON shapes.

- `GET /health` -> `{"status": "ok"}`
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`
- `GET|POST /webhook?token=...` - Elastic Email event notifications. Parameters arrive in the query string or as form fields (`status`, `to`, `transaction`, `messageid`, `target`, ...). The `token` must match `ELASTICEMAIL_WEBHOOK_TOKEN`.
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

## Quick Usage

```ruby
require "ElasticEmail"

ElasticEmail.configure do |config|
  config.api_key["X-ElasticEmail-ApiKey"] = ENV.fetch("ELASTICEMAIL_API_KEY")
end

result = ElasticEmail::EmailsApi.new.emails_transactional_post(
  ElasticEmail::EmailTransactionalMessageData.new(
    recipients: ElasticEmail::TransactionalRecipient.new(to: ["you@yourdomain.com"]),
    content: ElasticEmail::EmailContent.new(
      from: "Acme <hello@yourdomain.com>",
      subject: "Hello",
      body: [ElasticEmail::BodyPart.new(content_type: "HTML", content: "<p>Hello World</p>")]
    )
  )
)

puts result.transaction_id, result.message_id
```

Errors raise `ElasticEmail::ApiError` with `code` (HTTP status) and `response_body` (`{"Error": "..."}`).

## Project Structure

```
ruby-elasticemail-examples/
├── examples/
│   ├── ee.rb                     # Shared config (API key, env values, error helper)
│   ├── basic_send.rb             # Simple transactional email
│   ├── batch_send.rb             # Bulk send with merge fields
│   ├── with_attachments.rb       # Emails with files
│   ├── with_cid_attachments.rb   # Inline images
│   ├── with_template.rb          # Templates with merge values
│   ├── scheduled_send.rb         # Delayed delivery (TimeOffset)
│   ├── prevent_threading.rb      # Prevent Gmail threading
│   ├── contacts.rb               # Contacts and lists
│   ├── domains.rb                # Domain verification
│   ├── email_status.rb           # Delivery status by transaction id
│   ├── webhooks.rb               # Manage webhooks
│   ├── inbound.rb                # Manage inbound routes
│   ├── double_optin/
│   │   ├── subscribe.rb          # Double opt-in: subscribe
│   │   └── webhook.rb            # Double opt-in: click-based confirm server
│   ├── suppressions.rb           # Unsubscribes, bounces, complaints
│   ├── email_verification.rb     # Verify an address
│   ├── statistics.rb             # Account statistics
│   └── sub_accounts.rb           # Sub-accounts (read-only by default)
├── sinatra_app/
│   └── app.rb                    # Sinatra web app
├── rails_app/                    # Rails API app
│   ├── app/controllers/
│   ├── config/
│   ├── Gemfile
│   └── README.md
├── Gemfile
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email Ruby SDK](https://github.com/ElasticEmail/elasticemail-ruby)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
