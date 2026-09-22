use rust_elasticemail_examples::{config, from, print_api_error, to};
use std::collections::HashMap;
use ElasticEmail::apis::emails_api;
use ElasticEmail::models::{BodyContentType, BodyPart, EmailContent, EmailMessageData, EmailRecipient};

fn recipient(email: &str, firstname: &str, plan: &str) -> EmailRecipient {
    let fields = HashMap::from([
        ("firstname".to_string(), firstname.to_string()),
        ("plan".to_string(), plan.to_string()),
    ]);
    EmailRecipient { fields: Some(fields), ..EmailRecipient::new(email.to_string()) }
}

#[tokio::main]
async fn main() {
    let config = config();
    let to = to();

    // Bulk send: one API call, one personalized email per recipient.
    // Values from Recipients[].Fields replace {placeholders} in the body.
    // Up to 1000 recipients per request.
    let recipients = vec![
        recipient(&to, "Ann", "Pro"),
        recipient(&to, "Ben", "Starter"),
        recipient(&to, "Cleo", "Team"),
    ];
    let count = recipients.len();

    let content = EmailContent {
        subject: Some("Hi {firstname}, your {plan} plan is ready".to_string()),
        body: Some(vec![
            BodyPart {
                content: Some("<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>".to_string()),
                ..BodyPart::new(BodyContentType::Html)
            },
            BodyPart {
                content: Some("Hi {firstname}! Your {plan} plan is now active.".to_string()),
                ..BodyPart::new(BodyContentType::PlainText)
            },
        ]),
        ..EmailContent::new(from())
    };

    match emails_api::emails_post(&config, EmailMessageData::new(recipients, content)).await {
        Ok(result) => {
            let transaction_id = result.transaction_id.unwrap_or_default();
            println!("Bulk email queued for {} recipients.", count);
            println!("Transaction ID: {}", transaction_id);
            println!("Check delivery with: cargo run --example email_status -- {}", transaction_id);
        }
        Err(e) => {
            print_api_error("sending bulk email", &e);
            std::process::exit(1);
        }
    }
}
