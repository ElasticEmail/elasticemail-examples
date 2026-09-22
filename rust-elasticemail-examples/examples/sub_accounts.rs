use rust_elasticemail_examples::{config, env_or, print_api_error};
use ElasticEmail::apis::sub_accounts_api;
use ElasticEmail::models::{SubaccountEmailCreditsPayload, SubaccountPayload};

#[tokio::main]
async fn main() {
    let config = config();

    // Sub-accounts let you isolate customers or projects with their own API keys and credits.
    // Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.
    let create_enabled = env_or("CREATE_SUBACCOUNT", "false") == "true";
    let sub_email = env_or("SUBACCOUNT_EMAIL", &format!("sub-{}@example.com", chrono::Utc::now().timestamp_millis()));

    match sub_accounts_api::subaccounts_get(&config, Some(20), Some(0)).await {
        Ok(list) => {
            println!("Sub-accounts ({}):", list.len());
            for s in list {
                println!(
                    " - {} status={:?} credits={} sent={}",
                    s.email.unwrap_or_default(),
                    s.status,
                    s.email_credits.unwrap_or(0),
                    s.total_emails_sent.unwrap_or(0)
                );
            }
        }
        Err(e) => {
            print_api_error("list sub-accounts", &e);
            std::process::exit(1);
        }
    }

    if !create_enabled {
        println!("\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.");
        return;
    }

    let payload = SubaccountPayload {
        send_activation: Some(false),
        ..SubaccountPayload::new(sub_email.clone(), format!("Tmp-{}-Aa1!", uuid::Uuid::new_v4().simple()))
    };
    match sub_accounts_api::subaccounts_post(&config, payload).await {
        Ok(s) => println!("\nSub-account created: {}", s.email.unwrap_or_default()),
        Err(e) => {
            print_api_error("create sub-account", &e);
            std::process::exit(1);
        }
    }

    let credits = SubaccountEmailCreditsPayload {
        notes: Some("Initial allocation".to_string()),
        ..SubaccountEmailCreditsPayload::new(1000)
    };
    match sub_accounts_api::subaccounts_by_email_credits_patch(&config, &sub_email, credits).await {
        Ok(_) => println!("Assigned 1000 credits to {}", sub_email),
        Err(e) => {
            print_api_error("assign credits", &e);
            std::process::exit(1);
        }
    }

    match sub_accounts_api::subaccounts_by_email_apikey_get(&config, &sub_email).await {
        Ok(key) => println!("Sub-account API key retrieved (length): {}", key.len()),
        Err(e) => {
            print_api_error("get sub-account api key", &e);
            std::process::exit(1);
        }
    }
}
