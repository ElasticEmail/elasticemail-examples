use axum::body::Bytes;
use axum::extract::{OriginalUri, State};
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::Json;
use axum::routing::get;
use axum::Router;
use rust_elasticemail_examples::{api_error_message, config, env_or, read_webhook, sanitize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use ElasticEmail::apis::configuration::Configuration;
use ElasticEmail::apis::lists_api;
use ElasticEmail::models::EmailsPayload;

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.rs) pointing at /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.

struct AppState {
    config: Configuration,
    list_name: String,
    token: String,
    webhook_secret: String,
}

type ApiResult = Result<Json<Value>, (StatusCode, Json<Value>)>;

fn get_str(map: &HashMap<String, String>, key: &str) -> String {
    sanitize(map.get(key).map(String::as_str).unwrap_or(""))
}

// Signed webhooks (POST + JSON) are verified with ELASTICEMAIL_WEBHOOK_SECRET; unsigned ones
// (GET + query string) with ?token=ELASTICEMAIL_WEBHOOK_TOKEN. OriginalUri keeps the request
// target as sent (still URL-encoded) and Bytes is the raw body, both covered by the signature.
async fn webhook(
    State(state): State<Arc<AppState>>,
    method: Method,
    uri: OriginalUri,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult {
    let target = uri.path_and_query().map(|p| p.as_str()).unwrap_or("/");
    let header = |name: &str| headers.get(name).and_then(|v| v.to_str().ok()).map(String::from);
    let event = read_webhook(&state.webhook_secret, &state.token, method.as_str(), target, header, &body).map_err(
        |(status, message)| (StatusCode::from_u16(status).unwrap_or(StatusCode::UNAUTHORIZED), Json(json!({"error": message}))),
    )?;

    let status = get_str(&event, "status");
    let target = get_str(&event, "target");
    let recipient = get_str(&event, "to");

    // Test request sent when the webhook is saved.
    if status.is_empty() {
        return Ok(Json(json!({"ok": true})));
    }

    if status != "Clicked" || !target.contains("/double-optin/confirm") {
        return Ok(Json(json!({"received": true, "status": status, "message": "Event ignored"})));
    }

    let payload = EmailsPayload { emails: Some(vec![recipient.clone()]), ..EmailsPayload::new() };
    match lists_api::lists_by_name_contacts_post(&state.config, &state.list_name, payload).await {
        Ok(_) => {
            println!("Subscription confirmed via click: {}", recipient);
            Ok(Json(json!({"received": true, "confirmed": true, "email": recipient, "list": state.list_name})))
        }
        Err(e) => {
            let (status, message) = api_error_message(&e);
            eprintln!("Error adding contact to list: {} {}", status, message);
            Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": message}))))
        }
    }
}

#[tokio::main]
async fn main() {
    let state = Arc::new(AppState {
        config: config(),
        list_name: env_or("ELASTICEMAIL_LIST_NAME", "Newsletter"),
        token: env_or("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me"),
        webhook_secret: env_or("ELASTICEMAIL_WEBHOOK_SECRET", ""),
    });

    let app = Router::new()
        .route("/double-optin/webhook", get(webhook).post(webhook))
        .with_state(state);

    let port = env_or("PORT", "3000");
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    println!("Double opt-in webhook listening on http://localhost:{}/double-optin/webhook", port);
    axum::serve(listener, app).await.unwrap();
}
