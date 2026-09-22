use rust_elasticemail_examples::{config, env_or, print_api_error};
use ElasticEmail::apis::webhook_api;
use ElasticEmail::models::WebhookCreatePayload;

#[tokio::main]
async fn main() {
    let config = config();
    let public_url = env_or("PUBLIC_URL", "http://localhost:3000");
    let token = env_or("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");

    // Elastic Email does not sign webhook requests. The examples append a shared secret
    // as a query parameter and the receiving handler checks it.
    let webhook_url = format!("{}/webhook?token={}", public_url, urlencoding::encode(&token));

    // 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
    //    and answer 2xx (use a tunnel such as ngrok for local development).
    let payload = WebhookCreatePayload {
        notify_once_per_email: Some(false),
        notification_for_sent: Some(true),
        notification_for_opened: Some(true),
        notification_for_clicked: Some(true),
        notification_for_unsubscribed: Some(true),
        notification_for_abuse_report: Some(true),
        notification_for_error: Some(true),
        ..WebhookCreatePayload::new("examples-webhook".to_string(), webhook_url)
    };
    let webhook_id = match webhook_api::webhook_post(&config, payload).await {
        Ok(w) => {
            println!("Webhook created: {} {}", w.webhook_id.clone().unwrap_or_default(), w.url.unwrap_or_default());
            w.webhook_id
        }
        Err(e) => {
            print_api_error("create webhook", &e);
            std::process::exit(1);
        }
    };

    // 2. List
    match webhook_api::webhook_get(&config, Some(50), Some(0)).await {
        Ok(webhooks) => {
            println!("\nWebhooks ({}):", webhooks.len());
            for w in webhooks {
                println!(
                    " - {} {} {} enabled={}",
                    w.webhook_id.unwrap_or_default(),
                    w.name.unwrap_or_default(),
                    w.url.unwrap_or_default(),
                    w.is_enabled.unwrap_or(false)
                );
            }
        }
        Err(e) => {
            print_api_error("list webhooks", &e);
            std::process::exit(1);
        }
    }

    // 3. Delete the one we created (comment out to keep it)
    if let Some(id) = webhook_id {
        match webhook_api::webhook_by_publicid_delete(&config, &id).await {
            Ok(_) => println!("\nWebhook deleted: {}", id),
            Err(e) => {
                print_api_error("delete webhook", &e);
                std::process::exit(1);
            }
        }
    }
}
