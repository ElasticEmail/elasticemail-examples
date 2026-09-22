use rust_elasticemail_examples::{config, print_api_error};
use ElasticEmail::apis::statistics_api;

#[tokio::main]
async fn main() {
    let config = config();

    // Account-wide sending statistics for the last 30 days.
    // Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
    let to = chrono::Utc::now();
    let from = to - chrono::Duration::days(30);
    let from_iso = from.format("%Y-%m-%dT%H:%M:%S").to_string();
    let to_iso = to.format("%Y-%m-%dT%H:%M:%S").to_string();

    match statistics_api::statistics_get(&config, from_iso.clone(), Some(to_iso.clone())).await {
        Ok(s) => {
            println!("=== Statistics {} to {} ===", from_iso, to_iso);
            println!("Recipients:    {}", s.recipients.unwrap_or(0));
            println!("Emails total:  {}", s.email_total.unwrap_or(0));
            println!("Delivered:     {}", s.delivered.unwrap_or(0));
            println!("Bounced:       {}", s.bounced.unwrap_or(0));
            println!("In progress:   {}", s.in_progress.unwrap_or(0));
            println!("Opened:        {}", s.opened.unwrap_or(0));
            println!("Clicked:       {}", s.clicked.unwrap_or(0));
            println!("Unsubscribed:  {}", s.unsubscribed.unwrap_or(0));
            println!("Complaints:    {}", s.complaints.unwrap_or(0));
        }
        Err(e) => {
            print_api_error("fetching statistics", &e);
            std::process::exit(1);
        }
    }
}
