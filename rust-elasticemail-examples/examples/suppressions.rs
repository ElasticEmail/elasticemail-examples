use rust_elasticemail_examples::{config, print_api_error};
use ElasticEmail::apis::suppressions_api;

#[tokio::main]
async fn main() {
    let config = config();
    let email = std::env::args().nth(1).unwrap_or_else(|| "suppressed@example.com".to_string());

    // Suppressions are split into unsubscribes, bounces and complaints.
    // Adding to any list stops future sends to that address.
    match suppressions_api::suppressions_unsubscribes_post(&config, vec![email.clone()]).await {
        Ok(_) => println!("Added to unsubscribes: {}", email),
        Err(e) => {
            print_api_error("add unsubscribe", &e);
            std::process::exit(1);
        }
    }

    match suppressions_api::suppressions_by_email_get(&config, &email).await {
        Ok(s) => println!(
            "Suppression: email={} reason={} date_updated={}",
            s.email.unwrap_or_default(),
            s.friendly_error_message.unwrap_or_default(),
            s.date_updated.flatten().unwrap_or_default()
        ),
        Err(e) => {
            print_api_error("get suppression", &e);
            std::process::exit(1);
        }
    }

    match suppressions_api::suppressions_get(&config, Some(10), Some(0)).await {
        Ok(list) => {
            println!("\nAll suppressions (first {}):", list.len());
            for s in list {
                println!(" - {} {}", s.email.unwrap_or_default(), s.friendly_error_message.unwrap_or_default());
            }
        }
        Err(e) => {
            print_api_error("list suppressions", &e);
            std::process::exit(1);
        }
    }

    // Remove it again so the address can receive email
    match suppressions_api::suppressions_by_email_delete(&config, &email).await {
        Ok(_) => println!("\nRemoved from suppressions: {}", email),
        Err(e) => {
            print_api_error("delete suppression", &e);
            std::process::exit(1);
        }
    }
}
