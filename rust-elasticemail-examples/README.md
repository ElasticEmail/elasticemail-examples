# Rust Email API Examples - Elastic Email

Send transactional and bulk email from Rust with the [Elastic Email](https://elasticemail.com/email-api) email API. Standalone binaries plus an Axum web server, built on the official Elastic Email Rust SDK with Tokio.

> **First time here?** The [Rust quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Rust 1.75+ (with Cargo)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

The SDK is not published on crates.io. Cargo pulls it from GitHub by tag (see `Cargo.toml`).

```bash
# Build the project (downloads dependencies)
cargo build

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

## Standalone Examples

Run every command from this folder. Each example loads `.env`.

### Basic Email Sending
```bash
cargo run --example basic_send
```

### Batch Sending
```bash
cargo run --example batch_send
```

### With Attachments
```bash
cargo run --example with_attachments
```

### With CID (Inline) Attachments
```bash
cargo run --example with_cid_attachments
```

### Using Templates
```bash
cargo run --example with_template
```

### Scheduled Sending
```bash
cargo run --example scheduled_send
```

### Prevent Gmail Threading
```bash
cargo run --example prevent_threading
```

### Contacts and Lists
```bash
cargo run --example contacts
```

### Domain Management
```bash
cargo run --example domains
```

### Email Status
```bash
cargo run --example email_status -- <transactionId> [messageId]
```

### Webhooks
```bash
cargo run --example webhooks
```

### Inbound Routes
```bash
cargo run --example inbound
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
cargo run --example double_optin_subscribe -- user@example.com "John Doe"

# Click-tracking based confirmation server
cargo run --example double_optin_webhook
```

### Suppressions
```bash
cargo run --example suppressions -- [email]
```

### Email Verification
```bash
cargo run --example email_verification -- someone@example.com
```

### Statistics
```bash
cargo run --example statistics
```

### Sub-Accounts
```bash
cargo run --example sub_accounts
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true cargo run --example sub_accounts
```

## Axum Application

```bash
cargo run --bin axum_app

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Axum!"}'
```

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

```rust
use ElasticEmail::apis::configuration::{ApiKey, Configuration};
use ElasticEmail::apis::emails_api;
use ElasticEmail::models::{BodyContentType, BodyPart, EmailContent, EmailTransactionalMessageData, TransactionalRecipient};

#[tokio::main]
async fn main() {
    let config = Configuration {
        api_key: Some(ApiKey { prefix: None, key: "your_api_key".to_string() }),
        ..Default::default()
    };

    let content = EmailContent {
        subject: Some("Hello".to_string()),
        body: Some(vec![BodyPart {
            content: Some("<p>Hello World</p>".to_string()),
            ..BodyPart::new(BodyContentType::Html)
        }]),
        ..EmailContent::new("Acme <hello@yourdomain.com>".to_string())
    };
    let data = EmailTransactionalMessageData::new(
        TransactionalRecipient::new(vec!["you@yourdomain.com".to_string()]),
        content,
    );

    let result = emails_api::emails_transactional_post(&config, data).await.unwrap();
    println!("{:?} {:?}", result.transaction_id, result.message_id);
}
```

Errors are `ElasticEmail::apis::Error<T>`. API failures are `Error::ResponseError(ResponseContent { status, content, .. })` where `content` is the raw body, for example `{"Error":"APIKey Expired"}`. See `print_api_error` in `src/lib.rs`.

## Project Structure

```
rust-elasticemail-examples/
├── src/
│   └── lib.rs                       # Shared helpers (config, env, error printing, HMAC)
├── examples/
│   ├── basic_send.rs                # Simple transactional email
│   ├── batch_send.rs                # Bulk send with merge fields
│   ├── with_attachments.rs          # Emails with files
│   ├── with_cid_attachments.rs      # Inline images
│   ├── with_template.rs             # Templates with merge values
│   ├── scheduled_send.rs            # Delayed delivery (TimeOffset)
│   ├── prevent_threading.rs         # Prevent Gmail threading
│   ├── contacts.rs                  # Contacts and lists
│   ├── domains.rs                   # Domain verification
│   ├── email_status.rs              # Delivery status by transaction id
│   ├── webhooks.rs                  # Manage webhooks
│   ├── inbound.rs                   # Manage inbound routes
│   ├── double_optin_subscribe.rs    # Double opt-in: subscribe
│   ├── double_optin_webhook.rs      # Double opt-in: click-based confirm server
│   ├── suppressions.rs              # Unsubscribes, bounces, complaints
│   ├── email_verification.rs        # Verify an address
│   ├── statistics.rs                # Account statistics
│   └── sub_accounts.rs              # Sub-accounts (read-only by default)
├── axum_app/
│   └── src/main.rs                  # Axum web app
├── Cargo.toml
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email Rust SDK](https://github.com/ElasticEmail/elasticemail-rust)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
