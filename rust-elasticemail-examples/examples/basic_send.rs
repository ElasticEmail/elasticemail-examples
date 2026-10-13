use rust_elasticemail_examples::{config, from, print_api_error, to};
use ElasticEmail::apis::emails_api;
use ElasticEmail::models::{BodyContentType, BodyPart, EmailContent, EmailTransactionalMessageData, TransactionalRecipient};

#[tokio::main]
async fn main() {
    let config = config();

    let content = EmailContent {
        subject: Some("Hello from Elastic Email!".to_string()),
        body: Some(vec![
            BodyPart {
                content: Some("<h1>Welcome!</h1><p>This email was sent using the Elastic Email Rust SDK.</p>".to_string()),
                ..BodyPart::new(BodyContentType::Html)
            },
            BodyPart {
                content: Some("Welcome! This email was sent using the Elastic Email Rust SDK.".to_string()),
                ..BodyPart::new(BodyContentType::PlainText)
            },
        ]),
        ..EmailContent::new(from())
    };

    let data = EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![to()]), content);

    // Reuse this key only to retry this same send.
    let idempotency_key = uuid::Uuid::new_v4().to_string();

    match emails_api::emails_transactional_post_with_idempotency_key(&config, data, Some(&idempotency_key)).await {
        Ok(result) => {
            println!("Email sent successfully!");
            println!("Transaction ID: {}", result.transaction_id.unwrap_or_default());
            println!("Message ID: {}", result.message_id.unwrap_or_default());
            println!("Idempotency key: {}", idempotency_key);
        }
        Err(e) => {
            print_api_error("sending email", &e);
            std::process::exit(1);
        }
    }
}
