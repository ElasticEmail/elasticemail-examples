# Elixir Email API Examples - Elastic Email

Send transactional and bulk email from Elixir with the [Elastic Email](https://elasticemail.com/email-api) email API, including a Phoenix application that exposes send, webhook and inbound routes.

There is no official Elixir SDK. The examples use a small `ElasticEmail` module
(`lib/elastic_email.ex`) built on [Req](https://hex.pm/packages/req) that calls the
REST API v4 directly. JSON keys are the PascalCase names from the API reference.

> **First time here?** The [Elixir quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Elixir 1.15+ (OTP 25+)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

```bash
# Install dependencies
mix deps.get

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

`config/runtime.exs` loads `.env` and stops with a clear message if `ELASTICEMAIL_API_KEY` is missing.

## Standalone Examples

Run every script from this folder with `mix run`.

### Basic Email Sending
```bash
mix run examples/basic_send.exs
```

### Batch Sending
```bash
mix run examples/batch_send.exs
```

### With Attachments
```bash
mix run examples/with_attachments.exs
```

### With CID (Inline) Attachments
```bash
mix run examples/with_cid_attachments.exs
```

### Using Templates
```bash
mix run examples/with_template.exs
```

### Scheduled Sending
```bash
mix run examples/scheduled_send.exs
```

### Prevent Gmail Threading
```bash
mix run examples/prevent_threading.exs
```

### Contacts and Lists
```bash
mix run examples/contacts.exs
```

### Domain Management
```bash
mix run examples/domains.exs
```

### Email Status
```bash
mix run examples/email_status.exs <transactionId> [messageId]
```

### Webhooks
```bash
mix run examples/webhooks.exs
```

### Inbound Routes
```bash
mix run examples/inbound.exs
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
mix run examples/double_optin/subscribe.exs user@example.com "John Doe"

# Click-tracking based confirmation server (Plug + Bandit)
mix run examples/double_optin/webhook.exs
```

### Suppressions
```bash
mix run examples/suppressions.exs [email]
```

### Email Verification
```bash
mix run examples/email_verification.exs someone@example.com
```

### Statistics
```bash
mix run examples/statistics.exs
```

### Sub-Accounts
```bash
mix run examples/sub_accounts.exs
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true mix run examples/sub_accounts.exs
```

## Phoenix Application

```bash
cd phoenix_app
mix deps.get
mix phx.server

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Phoenix!"}'
```

The app reads `../.env`, so one `.env` file serves both the scripts and the server.

## API Endpoints

- `GET /health` -> `{"status": "ok"}`
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`
- `GET|POST /webhook?token=...` - Elastic Email event notifications. Parameters arrive in the query string or as form fields (`status`, `to`, `transaction`, `messageid`, `target`, ...). The `token` must match `ELASTICEMAIL_WEBHOOK_TOKEN`.
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

## Quick Usage

```elixir
# ELASTICEMAIL_API_KEY must be set in the environment
{:ok, data} =
  ElasticEmail.send_transactional(%{
    "Recipients" => %{"To" => ["you@yourdomain.com"]},
    "Content" => %{
      "From" => "Acme <hello@yourdomain.com>",
      "Subject" => "Hello",
      "Body" => [%{"ContentType" => "HTML", "Content" => "<p>Hello World</p>"}]
    }
  })

IO.puts("Transaction ID: #{data["TransactionID"]}")
IO.puts("Message ID: #{data["MessageID"]}")
```

Every call returns `{:ok, body}` or `{:error, status, body}`. `ElasticEmail.format_error/1`
turns the error tuple into `"400: <message>"`.

## Project Structure

```
elixir-elasticemail-examples/
├── lib/
│   ├── elastic_email.ex             # Req client: get/post/put/patch/delete, send_transactional
│   └── elastic_email/env.ex         # Env values (from, to, list name, ...)
├── examples/
│   ├── basic_send.exs               # Simple transactional email
│   ├── batch_send.exs               # Bulk send with merge fields
│   ├── with_attachments.exs         # Emails with files
│   ├── with_cid_attachments.exs     # Inline images
│   ├── with_template.exs            # Templates with merge values
│   ├── scheduled_send.exs           # Delayed delivery (TimeOffset)
│   ├── prevent_threading.exs        # Prevent Gmail threading
│   ├── contacts.exs                 # Contacts and lists
│   ├── domains.exs                  # Domain verification
│   ├── email_status.exs             # Delivery status by transaction id
│   ├── webhooks.exs                 # Manage webhooks
│   ├── inbound.exs                  # Manage inbound routes
│   ├── suppressions.exs             # Unsubscribes, bounces, complaints
│   ├── email_verification.exs       # Verify an address
│   ├── statistics.exs               # Account statistics
│   ├── sub_accounts.exs             # Sub-accounts (read-only by default)
│   └── double_optin/
│       ├── subscribe.exs            # Create contact + send confirmation
│       └── webhook.exs              # Click-based confirm server
├── phoenix_app/                     # Phoenix web app
│   ├── lib/
│   ├── config/
│   └── mix.exs
├── mix.exs
├── config/
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)
- [Req](https://hexdocs.pm/req)

## License

MIT
