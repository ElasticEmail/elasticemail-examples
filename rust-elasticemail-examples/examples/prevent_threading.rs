use rust_elasticemail_examples::{config, from, print_api_error, to};
use std::collections::HashMap;
use ElasticEmail::apis::emails_api;
use ElasticEmail::models::{BodyContentType, BodyPart, EmailContent, EmailTransactionalMessageData, TransactionalRecipient};

#[tokio::main]
async fn main() {
    let config = config();

    // Gmail groups emails into threads based on subject and Message-ID/References headers.
    // A unique X-Entity-Ref-ID header per email prevents this grouping.
    for i in 1..=3 {
        let headers = HashMap::from([("X-Entity-Ref-ID".to_string(), uuid::Uuid::new_v4().to_string())]);
        let content = EmailContent {
            subject: Some("Order Confirmation".to_string()), // Same subject for all
            body: Some(vec![BodyPart {
                content: Some(format!(
                    "<h1>Order Confirmation</h1><p>This is email #{}. Each appears as a separate conversation in Gmail.</p>",
                    i
                )),
                ..BodyPart::new(BodyContentType::Html)
            }]),
            headers: Some(headers),
            ..EmailContent::new(from())
        };

        let data = EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![to()]), content);

        match emails_api::emails_transactional_post(&config, data).await {
            Ok(result) => println!("Email #{} sent: {}", i, result.message_id.unwrap_or_default()),
            Err(e) => {
                print_api_error(&format!("sending email #{}", i), &e);
                std::process::exit(1);
            }
        }
    }

    println!("\nAll emails sent with unique X-Entity-Ref-ID headers.");
}
