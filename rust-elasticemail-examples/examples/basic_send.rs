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

    match emails_api::emails_transactional_post(&config, data).await {
        Ok(result) => {
            println!("Email sent successfully!");
            println!("Transaction ID: {}", result.transaction_id.unwrap_or_default());
            println!("Message ID: {}", result.message_id.unwrap_or_default());
        }
        Err(e) => {
            print_api_error("sending email", &e);
            std::process::exit(1);
        }
    }
}
