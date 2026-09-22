use rust_elasticemail_examples::{config, from, print_api_error, to};
use ElasticEmail::apis::emails_api;
use ElasticEmail::models::{
    BodyContentType, BodyPart, EmailContent, EmailTransactionalMessageData, Options, TransactionalRecipient,
};

#[tokio::main]
async fn main() {
    let config = config();

    // TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
    // Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
    let delay_minutes: i32 = 60;
    let scheduled_for = (chrono::Utc::now() + chrono::Duration::minutes(delay_minutes as i64)).to_rfc3339();

    let content = EmailContent {
        subject: Some("Scheduled Email".to_string()),
        body: Some(vec![BodyPart {
            content: Some(format!("<h1>Scheduled Email</h1><p>This email was scheduled for {}.</p>", scheduled_for)),
            ..BodyPart::new(BodyContentType::Html)
        }]),
        ..EmailContent::new(from())
    };

    let data = EmailTransactionalMessageData {
        options: Some(Box::new(Options { time_offset: Some(Some(delay_minutes)), ..Options::new() })),
        ..EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![to()]), content)
    };

    match emails_api::emails_transactional_post(&config, data).await {
        Ok(result) => {
            println!("Email scheduled for {}", scheduled_for);
            println!("Transaction ID: {}", result.transaction_id.unwrap_or_default());
            println!("Message ID: {}", result.message_id.unwrap_or_default());
        }
        Err(e) => {
            print_api_error("scheduling email", &e);
            std::process::exit(1);
        }
    }
}
