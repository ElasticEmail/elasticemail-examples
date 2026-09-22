use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json, Redirect, Response};
use axum::routing::{get, post};
use axum::Router;
use rust_elasticemail_examples::{api_error_message, config, env_or, from, hmac_hex, sanitize, token_ok};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use ElasticEmail::apis::configuration::Configuration;
use ElasticEmail::apis::{contacts_api, emails_api, lists_api};
use ElasticEmail::models::{
    BodyContentType, BodyPart, ContactPayload, ContactStatus, EmailContent, EmailTransactionalMessageData,
    EmailsPayload, MessageAttachment, TransactionalRecipient,
};

struct AppState {
    config: Configuration,
    from: String,
    contact_email: String,
    list_name: String,
    public_url: String,
    secret: String,
    confirm_redirect_url: Option<String>,
}

type ApiError = (StatusCode, Json<Value>);
type ApiResult = Result<Json<Value>, ApiError>;

fn unauthorized() -> ApiError {
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid token"})))
}

fn bad_request(message: &str) -> ApiError {
    (StatusCode::BAD_REQUEST, Json(json!({"error": message})))
}

/// Maps an SDK error to the API status code and its `Error` message.
fn api_error<T: std::fmt::Debug>(err: ElasticEmail::apis::Error<T>) -> ApiError {
    let (status, message) = api_error_message(&err);
    let status = StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (status, Json(json!({"error": message})))
}

fn get_str(map: &HashMap<String, String>, key: &str) -> String {
    sanitize(map.get(key).map(String::as_str).unwrap_or(""))
}

fn html_part(content: String) -> BodyPart {
    BodyPart { content: Some(content), ..BodyPart::new(BodyContentType::Html) }
}

/// Elastic Email webhooks and inbound notifications are form-encoded. Parse the raw body
/// so GET requests (empty body) and POSTs share one handler.
fn parse_form(body: &Bytes) -> HashMap<String, String> {
    url::form_urlencoded::parse(body).into_owned().collect()
}

#[tokio::main]
async fn main() {
    let config = config();
    let from = from();
    let state = Arc::new(AppState {
        config,
        contact_email: env_or("CONTACT_EMAIL", &from),
        from,
        list_name: env_or("ELASTICEMAIL_LIST_NAME", "Newsletter"),
        public_url: env_or("PUBLIC_URL", "http://localhost:3000"),
        secret: env_or("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me"),
        confirm_redirect_url: std::env::var("CONFIRM_REDIRECT_URL").ok().filter(|v| !v.is_empty()),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/send", post(send))
        .route("/webhook", get(webhook).post(webhook))
        .route("/inbound", post(inbound))
        .route("/double-optin/subscribe", post(double_optin_subscribe))
        .route("/double-optin/confirm", get(double_optin_confirm))
        .route("/double-optin/webhook", post(double_optin_webhook))
        .with_state(state);

    let port = env_or("PORT", "3000");
    let addr = format!("0.0.0.0:{}", port);

    println!("Axum server running on http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

#[derive(Deserialize)]
struct SendRequest {
    to: Option<String>,
    subject: Option<String>,
    message: Option<String>,
}

async fn send(State(state): State<Arc<AppState>>, Json(body): Json<SendRequest>) -> ApiResult {
    let (Some(to), Some(subject), Some(message)) = (body.to, body.subject, body.message) else {
        return Err(bad_request("Missing required fields: to, subject, message"));
    };
    if to.is_empty() || subject.is_empty() || message.is_empty() {
        return Err(bad_request("Missing required fields: to, subject, message"));
    }

    let content = EmailContent {
        subject: Some(subject),
        body: Some(vec![html_part(format!("<p>{}</p>", message))]),
        ..EmailContent::new(state.from.clone())
    };
    let data = EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![to]), content);

    let result = emails_api::emails_transactional_post(&state.config, data).await.map_err(api_error)?;
    Ok(Json(json!({
        "success": true,
        "transactionId": result.transaction_id,
        "messageId": result.message_id,
    })))
}

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
async fn webhook(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HashMap<String, String>>,
    body: Bytes,
) -> ApiResult {
    if !token_ok(query.get("token").map(String::as_str).unwrap_or(""), &state.secret) {
        return Err(unauthorized());
    }

    let mut event = query;
    event.extend(parse_form(&body));
    let status = get_str(&event, "status");

    if status.is_empty() {
        // Validation ping or empty request
        return Ok(Json(json!({"ok": true})));
    }

    println!(
        "Webhook event: {} to: {} transaction: {}",
        status,
        get_str(&event, "to"),
        get_str(&event, "transaction")
    );

    match status.as_str() {
        "Sent" => println!("Email sent, message id: {}", get_str(&event, "messageid")),
        "Opened" => println!("Email opened from {} {}", get_str(&event, "Country"), get_str(&event, "City")),
        "Clicked" => println!("Link clicked: {}", get_str(&event, "target")),
        "Error" => println!("Bounce/error, category: {}", get_str(&event, "category")),
        "AbuseReport" => println!("Complaint received"),
        "Unsubscribed" => println!("Recipient unsubscribed"),
        _ => {}
    }

    Ok(Json(json!({"received": true, "status": status})))
}

// Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
async fn inbound(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HashMap<String, String>>,
    body: Bytes,
) -> ApiResult {
    if !token_ok(query.get("token").map(String::as_str).unwrap_or(""), &state.secret) {
        return Err(unauthorized());
    }

    let mail = parse_form(&body);
    let mut attachments: Vec<(String, Option<String>)> = mail
        .iter()
        .filter(|(k, _)| k.starts_with("att") && k.ends_with("_name") && k[3..k.len() - 5].chars().all(|c| c.is_ascii_digit()))
        .map(|(k, name)| (name.clone(), mail.get(&k.replace("_name", "_content")).cloned()))
        .collect();
    attachments.sort();

    println!(
        "Inbound email from: {} subject: {}",
        get_str(&mail, "from_email"),
        get_str(&mail, "subject")
    );
    let names: Vec<&str> = attachments.iter().map(|(n, _)| n.as_str()).collect();
    println!("Attachments: {}", if names.is_empty() { "none".to_string() } else { names.join(", ") });

    // Forward a copy to the team inbox. Inbound attachment content is base64; the SDK
    // expects raw bytes and re-encodes on serialization.
    let body_html = mail.get("body_html").cloned().filter(|v| !v.is_empty()).unwrap_or_else(|| {
        format!("<pre>{}</pre>", mail.get("body_text").cloned().unwrap_or_default().replace('<', "&lt;"))
    });
    let forwarded: Vec<MessageAttachment> = attachments
        .into_iter()
        .filter_map(|(name, content)| {
            let encoded = content.filter(|c| !c.is_empty())?;
            let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded).ok()?;
            Some(MessageAttachment::new(bytes, name))
        })
        .collect();

    let content = EmailContent {
        reply_to: mail.get("from_email").cloned(),
        subject: Some(format!("Fwd: {}", mail.get("subject").cloned().unwrap_or_else(|| "(no subject)".to_string()))),
        body: Some(vec![html_part(body_html)]),
        attachments: Some(forwarded),
        ..EmailContent::new(state.from.clone())
    };
    let data =
        EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![state.contact_email.clone()]), content);

    let result = emails_api::emails_transactional_post(&state.config, data).await.map_err(api_error)?;
    Ok(Json(json!({"received": true, "forwardedMessageId": result.message_id})))
}

#[derive(Deserialize)]
struct SubscribeRequest {
    email: Option<String>,
    #[serde(default)]
    name: String,
}

fn confirm_url(state: &AppState, email: &str) -> String {
    format!(
        "{}/double-optin/confirm?email={}&token={}",
        state.public_url,
        urlencoding::encode(email),
        hmac_hex(&state.secret, email)
    )
}

async fn double_optin_subscribe(State(state): State<Arc<AppState>>, Json(body): Json<SubscribeRequest>) -> ApiResult {
    let Some(email) = body.email.filter(|e| !e.is_empty()) else {
        return Err(bad_request("Missing required field: email"));
    };
    let name = body.name;

    let confirm_url = confirm_url(&state, &email);
    let greeting = if name.is_empty() { "Welcome!".to_string() } else { format!("Welcome, {}!", name) };

    // Stored as Transactional so it receives the confirmation but no campaigns yet
    let contact = ContactPayload {
        first_name: Some(name.split_whitespace().next().unwrap_or("").to_string()),
        status: Some(ContactStatus::Transactional),
        ..ContactPayload::new(email.clone())
    };
    contacts_api::contacts_post(&state.config, vec![contact], None).await.map_err(api_error)?;

    let html = format!(
        r#"<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>{}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="{}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>"#,
        greeting, confirm_url
    );
    let content = EmailContent {
        subject: Some("Confirm your subscription".to_string()),
        body: Some(vec![html_part(html)]),
        ..EmailContent::new(state.from.clone())
    };
    let data = EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![email]), content);

    let result = emails_api::emails_transactional_post(&state.config, data).await.map_err(api_error)?;
    Ok(Json(json!({
        "success": true,
        "message": "Confirmation email sent",
        "messageId": result.message_id,
    })))
}

async fn double_optin_confirm(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Response, ApiError> {
    let email = query.get("email").cloned().unwrap_or_default();
    let token = query.get("token").cloned().unwrap_or_default();

    if email.is_empty() || !token_ok(&token, &hmac_hex(&state.secret, &email)) {
        return Err(bad_request("Invalid confirmation link"));
    }

    let payload = EmailsPayload { emails: Some(vec![email.clone()]), ..EmailsPayload::new() };
    lists_api::lists_by_name_contacts_post(&state.config, &state.list_name, payload)
        .await
        .map_err(api_error)?;

    if let Some(url) = &state.confirm_redirect_url {
        return Ok(Redirect::to(url).into_response());
    }
    Ok(Json(json!({"confirmed": true, "email": email, "list": state.list_name})).into_response())
}

// Click-tracking based confirmation: create a webhook for Clicked events pointing here.
async fn double_optin_webhook(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HashMap<String, String>>,
    body: Bytes,
) -> ApiResult {
    if !token_ok(query.get("token").map(String::as_str).unwrap_or(""), &state.secret) {
        return Err(unauthorized());
    }

    let mut event = query;
    event.extend(parse_form(&body));
    let status = get_str(&event, "status");
    let target = get_str(&event, "target");
    let recipient = get_str(&event, "to");

    if status != "Clicked" || !target.contains("/double-optin/confirm") {
        return Ok(Json(json!({"received": true, "status": status, "message": "Event ignored"})));
    }

    let payload = EmailsPayload { emails: Some(vec![recipient.clone()]), ..EmailsPayload::new() };
    lists_api::lists_by_name_contacts_post(&state.config, &state.list_name, payload)
        .await
        .map_err(api_error)?;

    Ok(Json(json!({"received": true, "confirmed": true, "email": recipient})))
}
