use rust_elasticemail_examples::{config, env_or, print_api_error};
use ElasticEmail::apis::webhook_api;
use ElasticEmail::models::{WebhookCreatePayload, WebhookDeliveryMethod};

#[tokio::main]
async fn main() {
    let config = config();
    let public_url = env_or("PUBLIC_URL", "http://localhost:3000");

    // Signed webhooks: Elastic Email POSTs each event as JSON and signs it with HMAC-SHA256
    // (X-ElasticEmail-Signature). The handler verifies the signature with the secret returned
    // below, so the URL needs no ?token=. Signing and the delivery method can't be changed later.
    let webhook_url = format!("{}/webhook", public_url);

    // 1. Create. Elastic Email sends a test request to the URL on save, so the handler must be
    //    reachable (use a tunnel such as ngrok for local development). The handler doesn't know the
    //    secret yet and answers 401, which Elastic Email accepts for that test.
    let payload = WebhookCreatePayload {
        notify_once_per_email: Some(false),
        notification_for_sent: Some(true),
        notification_for_opened: Some(true),
        notification_for_clicked: Some(true),
        notification_for_unsubscribed: Some(true),
        notification_for_abuse_report: Some(true),
        notification_for_error: Some(true),
        enable_signing: Some(Some(true)),
        delivery_method: Some(WebhookDeliveryMethod::PostJson),
        ..WebhookCreatePayload::new("examples-webhook".to_string(), webhook_url)
    };
    let webhook_id = match webhook_api::webhook_post(&config, payload).await {
        Ok(w) => {
            println!("Webhook created: {} {}", w.webhook_id.clone().unwrap_or_default(), w.url.unwrap_or_default());
            // The secret is returned only here. Store it as ELASTICEMAIL_WEBHOOK_SECRET.
            println!(
                "Signing secret (shown once, store it as ELASTICEMAIL_WEBHOOK_SECRET): {}",
                w.signing_secret.unwrap_or_default()
            );
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

    // 3. Rotate the signing secret. The old one stops working at once (no grace period).
    if let Some(id) = &webhook_id {
        match webhook_api::webhook_by_publicid_secret_rotate_post(&config, id).await {
            Ok(w) => println!(
                "\nNew signing secret (store it as ELASTICEMAIL_WEBHOOK_SECRET): {}",
                w.signing_secret.unwrap_or_default()
            ),
            Err(e) => {
                print_api_error("rotate webhook secret", &e);
                std::process::exit(1);
            }
        }
    }

    // 4. Delete the one we created (comment out to keep it)
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
