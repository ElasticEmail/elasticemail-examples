# Send your first email with Rust

Five minutes from a clean clone to a delivered email, using the Elastic Email Rust SDK with Tokio.
The web example uses Axum.

## Prerequisites

- Rust 1.75+ with Cargo
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

## 3. Install

The SDK is not published on crates.io. Cargo pulls it from GitHub by tag:

```toml
[dependencies]
ElasticEmail = { git = "https://github.com/ElasticEmail/elasticemail-rust", tag = "4.2.0" }
tokio = { version = "1", features = ["full"] }
dotenvy = "0.15"
```

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/rust-elasticemail-examples

cargo build          # first build fetches the SDK from GitHub
cp .env.example .env
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

```rust
use ElasticEmail::apis::configuration::{ApiKey, Configuration};
use ElasticEmail::apis::emails_api;
use ElasticEmail::models::{
    BodyContentType, BodyPart, EmailContent, EmailTransactionalMessageData, TransactionalRecipient,
};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let config = Configuration {
        api_key: Some(ApiKey { prefix: None, key: std::env::var("ELASTICEMAIL_API_KEY").unwrap() }),
        ..Default::default()
    };

    let content = EmailContent {
        subject: Some("Hello from Elastic Email!".to_string()),
        body: Some(vec![
            BodyPart {
                content: Some("<h1>Welcome!</h1>".to_string()),
                ..BodyPart::new(BodyContentType::Html)
            },
            BodyPart {
                content: Some("Welcome!".to_string()),
                ..BodyPart::new(BodyContentType::PlainText)
            },
        ]),
        ..EmailContent::new(std::env::var("EMAIL_FROM").unwrap())
    };

    let data = EmailTransactionalMessageData::new(
        TransactionalRecipient::new(vec![std::env::var("EMAIL_TO").unwrap()]),
        content,
    );

    match emails_api::emails_transactional_post(&config, data).await {
        Ok(result) => println!("Transaction ID: {}", result.transaction_id.unwrap_or_default()),
        Err(e) => eprintln!("send failed: {e}"),
    }
}
```

Two idioms worth noting: API calls are free functions in a module (`emails_api::...`) taking
`&Configuration`, and models use `::new(required_fields)` plus struct update syntax (`..`) for the
optional ones.

Run the version in this repository:

```bash
cargo run --example basic_send
```

`src/lib.rs` holds the shared helpers: `config()`, `from()`, `to()`, `print_api_error()`,
`api_error_message()`, plus `token_ok()` and `hmac_hex()` for the webhook and double opt-in examples.

## 6. Or run the Axum app

```bash
cargo run --bin axum_app
```

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Axum!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## Handling failures

```rust
match emails_api::emails_transactional_post(&config, data).await {
    Ok(result) => { /* ... */ }
    Err(e) => {
        let (status, message) = api_error_message(&e);   // parses {"Error": "..."}
    }
}
```

Only the `Error::ResponseError` variant carries a status and a body; everything else is a transport
failure. `is_not_found()` and `already_exists()` cover the two cases worth branching on. See
[Error handling](../docs/error-handling.md).

## Next steps

```bash
cargo run --example batch_send            # one call, personalized per recipient
cargo run --example with_attachments      # base64 file attachment
cargo run --example with_cid_attachments  # inline image via cid:
cargo run --example with_template         # hosted template + merge values
cargo run --example webhooks              # create, list, delete a webhook
cargo run --example email_status -- <transactionId>
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every example and route | [README.md](README.md) |
