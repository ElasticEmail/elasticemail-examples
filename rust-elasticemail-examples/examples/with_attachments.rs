use rust_elasticemail_examples::{config, from, print_api_error, to};
use ElasticEmail::apis::emails_api;
use ElasticEmail::models::{
    BodyContentType, BodyPart, EmailContent, EmailTransactionalMessageData, MessageAttachment, TransactionalRecipient,
};

#[tokio::main]
async fn main() {
    let config = config();

    let file_content = format!(
        "Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: {}\n",
        chrono::Utc::now().to_rfc3339()
    );

    // The SDK base64-encodes BinaryContent when serializing, so pass raw bytes.
    // Total message size limit applies (see account limits).
    let attachment = MessageAttachment {
        content_type: Some("text/plain".to_string()),
        ..MessageAttachment::new(file_content.into_bytes(), "sample.txt".to_string())
    };

    let content = EmailContent {
        subject: Some("Email with Attachment".to_string()),
        body: Some(vec![BodyPart {
            content: Some("<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>".to_string()),
            ..BodyPart::new(BodyContentType::Html)
        }]),
        attachments: Some(vec![attachment]),
        ..EmailContent::new(from())
    };

    let data = EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![to()]), content);

    match emails_api::emails_transactional_post(&config, data).await {
        Ok(result) => {
            println!("Email with attachment sent successfully!");
            println!("Transaction ID: {}", result.transaction_id.unwrap_or_default());
            println!("Message ID: {}", result.message_id.unwrap_or_default());
        }
        Err(e) => {
            print_api_error("sending email", &e);
            std::process::exit(1);
        }
    }
}
