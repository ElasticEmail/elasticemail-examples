use rust_elasticemail_examples::{config, print_api_error};
use ElasticEmail::apis::emails_api;

#[tokio::main]
async fn main() {
    let config = config();

    // Usage: cargo run --example email_status -- <transactionId> [messageId]
    // Both ids are returned by every send call.
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(transaction_id) = args.first() else {
        eprintln!("Usage: cargo run --example email_status -- <transactionId> [messageId]");
        std::process::exit(1);
    };
    let message_id = args.get(1);

    match emails_api::emails_by_transactionid_status_get(
        &config,
        transaction_id,
        Some(true), // show_failed
        Some(true), // show_sent
        Some(true), // show_delivered
        Some(true), // show_pending
        Some(true), // show_opened
        Some(true), // show_clicked
        None,
        None,
        None,
        None,
    )
    .await
    {
        Ok(s) => {
            println!("=== Transaction status ===");
            println!("Status:      {}", s.status.unwrap_or_default());
            println!("Recipients:  {}", s.recipients_count.unwrap_or(0));
            println!("Sent:        {} {:?}", s.sent_count.unwrap_or(0), s.sent.unwrap_or_default());
            println!("Delivered:   {} {:?}", s.delivered_count.unwrap_or(0), s.delivered.unwrap_or_default());
            println!("Pending:     {}", s.pending_count.unwrap_or(0));
            println!("Opened:      {}", s.opened_count.unwrap_or(0));
            println!("Clicked:     {}", s.clicked_count.unwrap_or(0));
            println!("Failed:      {} {:?}", s.failed_count.unwrap_or(0), s.failed.unwrap_or_default());
        }
        Err(e) => {
            print_api_error("fetching status", &e);
            std::process::exit(1);
        }
    }

    if let Some(message_id) = message_id {
        match emails_api::emails_by_msgid_view_get(&config, message_id).await {
            Ok(m) => {
                let preview = m.preview.map(|p| *p).unwrap_or_default();
                let status = m.status.map(|s| *s).unwrap_or_default();
                println!("\n=== Message ===");
                println!("From:     {}", preview.from.unwrap_or_default());
                println!("Subject:  {}", preview.subject.unwrap_or_default());
                println!("Status:   {} {}", status.status_name.unwrap_or_default(), status.date_sent.unwrap_or_default());
                let body = preview.body.unwrap_or_default();
                let short: String = body.chars().take(200).collect();
                println!("Body preview: {}{}", short, if body.chars().count() > 200 { "..." } else { "" });
            }
            Err(e) => print_api_error("fetching message", &e),
        }
    }
}
