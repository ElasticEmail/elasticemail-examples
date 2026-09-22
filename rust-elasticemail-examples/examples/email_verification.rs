use rust_elasticemail_examples::{config, print_api_error, to};
use ElasticEmail::apis::verifications_api;

#[tokio::main]
async fn main() {
    let config = config();

    // Usage: cargo run --example email_verification -- someone@example.com
    let email = std::env::args().nth(1).unwrap_or_else(to);

    // Email verification is a paid feature. Accounts without it get a 4xx here.
    if let Err(e) = verifications_api::verifications_by_email_post(&config, &email).await {
        print_api_error("verifying email", &e);
        std::process::exit(1);
    }

    match verifications_api::verifications_by_email_get(&config, &email).await {
        Ok(r) => {
            println!("=== Verification result ===");
            println!("Email:       {}", r.email.unwrap_or_default());
            println!("Result:      {:?}", r.result);
            println!("Reason:      {}", r.reason.unwrap_or_default());
            println!("Disposable:  {}", r.disposable.unwrap_or(false));
            println!("Role:        {}", r.role.unwrap_or(false));
            if let Some(suggestion) = r.suggested_spelling.filter(|s| !s.is_empty()) {
                println!("Did you mean: {}", suggestion);
            }
        }
        Err(e) => {
            print_api_error("verifying email", &e);
            std::process::exit(1);
        }
    }
}
