use base64::Engine;
use rust_elasticemail_examples::{config, from, print_api_error, to};
use ElasticEmail::apis::emails_api;
use ElasticEmail::models::{
    BodyContentType, BodyPart, EmailContent, EmailTransactionalMessageData, MessageAttachment, TransactionalRecipient,
};

// Minimal 1x1 PNG placeholder (base64-encoded)
const PLACEHOLDER_IMAGE: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

#[tokio::main]
async fn main() {
    let config = config();

    let image = base64::engine::general_purpose::STANDARD
        .decode(PLACEHOLDER_IMAGE)
        .expect("valid base64 placeholder");

    // Elastic Email derives the Content-ID of an attachment from its file name.
    // Reference the attachment Name after "cid:" to embed it inline.
    let attachment = MessageAttachment {
        content_type: Some("image/png".to_string()),
        ..MessageAttachment::new(image, "logo.png".to_string())
    };

    let html = r#"<div style="font-family: Arial, sans-serif; padding: 20px;">
  <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
  <h1>Welcome!</h1>
  <p>This email contains an inline image referenced by Content-ID.</p>
</div>"#;

    let content = EmailContent {
        subject: Some("Email with Inline Image".to_string()),
        body: Some(vec![BodyPart { content: Some(html.to_string()), ..BodyPart::new(BodyContentType::Html) }]),
        attachments: Some(vec![attachment]),
        ..EmailContent::new(from())
    };

    let data = EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![to()]), content);

    match emails_api::emails_transactional_post(&config, data).await {
        Ok(result) => {
            println!("Email with inline image sent successfully!");
            println!("Transaction ID: {}", result.transaction_id.unwrap_or_default());
            println!("Message ID: {}", result.message_id.unwrap_or_default());
        }
        Err(e) => {
            print_api_error("sending email", &e);
            std::process::exit(1);
        }
    }
}
