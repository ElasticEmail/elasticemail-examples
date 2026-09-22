use rust_elasticemail_examples::{config, env_or, from, hmac_hex, print_api_error};
use ElasticEmail::apis::{contacts_api, emails_api};
use ElasticEmail::models::{
    BodyContentType, BodyPart, ContactPayload, ContactStatus, EmailContent, EmailTransactionalMessageData,
    TransactionalRecipient,
};

#[tokio::main]
async fn main() {
    let config = config();
    let public_url = env_or("PUBLIC_URL", "http://localhost:3000");
    let secret = env_or("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");

    // Usage: cargo run --example double_optin_subscribe -- user@example.com "John Doe"
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(email) = args.first().cloned() else {
        eprintln!("Usage: cargo run --example double_optin_subscribe -- <email> [\"Name\"]");
        std::process::exit(1);
    };
    let name = args.get(1).cloned().unwrap_or_default();
    let mut parts = name.split_whitespace();
    let first_name = parts.next().unwrap_or("").to_string();
    let last_name = parts.collect::<Vec<_>>().join(" ");

    // The confirm link carries an HMAC of the email so the confirm endpoint can trust it.
    let confirm_token = hmac_hex(&secret, &email);
    let confirm_url = format!(
        "{}/double-optin/confirm?email={}&token={}",
        public_url,
        urlencoding::encode(&email),
        confirm_token
    );

    // Step 1: store the contact without adding it to the marketing list.
    // Status "Transactional" allows sending the confirmation but excludes it from campaigns.
    let contact = ContactPayload {
        first_name: Some(first_name),
        last_name: Some(last_name),
        status: Some(ContactStatus::Transactional),
        ..ContactPayload::new(email.clone())
    };
    if let Err(e) = contacts_api::contacts_post(&config, vec![contact], None).await {
        print_api_error("store contact", &e);
        std::process::exit(1);
    }
    println!("Contact stored (unconfirmed): {}", email);

    // Step 2: send the confirmation email
    let greeting = if name.is_empty() { "Welcome!".to_string() } else { format!("Welcome, {}!", name) };
    let html = format!(
        r#"<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>{}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="{}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>"#,
        greeting, confirm_url
    );
    let content = EmailContent {
        subject: Some("Confirm your subscription".to_string()),
        body: Some(vec![
            BodyPart { content: Some(html), ..BodyPart::new(BodyContentType::Html) },
            BodyPart {
                content: Some(format!("{}\n\nConfirm your subscription: {}", greeting, confirm_url)),
                ..BodyPart::new(BodyContentType::PlainText)
            },
        ]),
        ..EmailContent::new(from())
    };
    let data = EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![email]), content);

    match emails_api::emails_transactional_post(&config, data).await {
        Ok(result) => {
            println!("Confirmation email sent. Message ID: {}", result.message_id.unwrap_or_default());
            println!("Confirm URL: {}", confirm_url);
            println!("\nWhen the link is opened, GET /double-optin/confirm in axum_app adds the contact to the list.");
        }
        Err(e) => {
            print_api_error("send confirmation", &e);
            std::process::exit(1);
        }
    }
}
