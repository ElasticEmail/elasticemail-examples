use axum::extract::{Form, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use axum::routing::get;
use axum::Router;
use rust_elasticemail_examples::{api_error_message, config, env_or, sanitize, token_ok};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use ElasticEmail::apis::configuration::Configuration;
use ElasticEmail::apis::lists_api;
use ElasticEmail::models::EmailsPayload;

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see webhooks.rs) pointing at POST /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.

struct AppState {
    config: Configuration,
    list_name: String,
    token: String,
}

type ApiResult = Result<Json<Value>, (StatusCode, Json<Value>)>;

fn unauthorized() -> (StatusCode, Json<Value>) {
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid token"})))
}

fn get_str(map: &HashMap<String, String>, key: &str) -> String {
    sanitize(map.get(key).map(String::as_str).unwrap_or(""))
}

// Elastic Email validates the URL with a GET when the webhook is saved.
async fn validate(State(state): State<Arc<AppState>>, Query(query): Query<HashMap<String, String>>) -> ApiResult {
    if !token_ok(query.get("token").map(String::as_str).unwrap_or(""), &state.token) {
        return Err(unauthorized());
    }
    Ok(Json(json!({"ok": true})))
}

async fn webhook(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HashMap<String, String>>,
    Form(form): Form<HashMap<String, String>>,
) -> ApiResult {
    if !token_ok(query.get("token").map(String::as_str).unwrap_or(""), &state.token) {
        return Err(unauthorized());
    }

    let mut event = query;
    event.extend(form);
    let status = get_str(&event, "status");
    let target = get_str(&event, "target");
    let recipient = get_str(&event, "to");

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
    });

    let app = Router::new()
        .route("/double-optin/webhook", get(validate).post(webhook))
        .with_state(state);

    let port = env_or("PORT", "3000");
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    println!("Double opt-in webhook listening on http://localhost:{}/double-optin/webhook", port);
    axum::serve(listener, app).await.unwrap();
}
