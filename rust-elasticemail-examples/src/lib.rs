//! Shared helpers for the examples: configuration from env and API error printing.

use ElasticEmail::apis::configuration::{ApiKey, Configuration};
use ElasticEmail::apis::Error;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

/// Loads `.env` and builds an SDK configuration. Exits when ELASTICEMAIL_API_KEY is missing.
pub fn config() -> Configuration {
    dotenvy::dotenv().ok();
    let key = match std::env::var("ELASTICEMAIL_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => {
            eprintln!("ELASTICEMAIL_API_KEY environment variable is required");
            std::process::exit(1);
        }
    };
    Configuration {
        api_key: Some(ApiKey { prefix: None, key }),
        ..Default::default()
    }
}

pub fn env_or(name: &str, default: &str) -> String {
    std::env::var(name)
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| default.to_string())
}

pub fn from() -> String {
    env_or("EMAIL_FROM", "Acme <hello@yourdomain.com>")
}

pub fn to() -> String {
    env_or("EMAIL_TO", "you@yourdomain.com")
}

/// Prints the HTTP status and the raw body (`{"Error":"..."}`) for API failures,
/// or the transport error otherwise.
pub fn print_api_error<T: std::fmt::Debug>(step: &str, err: &Error<T>) {
    match err {
        Error::ResponseError(r) => eprintln!("Error ({}): {} {}", step, r.status.as_u16(), r.content),
        other => eprintln!("Error ({}): {}", step, other),
    }
}

/// Extracts the `Error` message from an API failure body, falling back to Display.
pub fn api_error_message<T: std::fmt::Debug>(err: &Error<T>) -> (u16, String) {
    match err {
        Error::ResponseError(r) => {
            let message = serde_json::from_str::<serde_json::Value>(&r.content)
                .ok()
                .and_then(|v| v.get("Error").and_then(|e| e.as_str()).map(String::from))
                .unwrap_or_else(|| r.content.clone());
            (r.status.as_u16(), message)
        }
        other => (500, other.to_string()),
    }
}

pub fn is_not_found<T>(err: &Error<T>) -> bool {
    matches!(err, Error::ResponseError(r) if r.status.as_u16() == 404)
}

/// True for the 400 returned when a list or domain with the same name already exists.
pub fn already_exists<T>(err: &Error<T>) -> bool {
    match err {
        Error::ResponseError(r) if r.status.as_u16() == 400 => {
            let body = r.content.to_lowercase();
            body.contains("exist") || body.contains("already")
        }
        _ => false,
    }
}

/// Constant-time comparison of the shared secret carried in `?token=`.
pub fn token_ok(given: &str, expected: &str) -> bool {
    given.as_bytes().ct_eq(expected.as_bytes()).into()
}

/// Hex HMAC-SHA256 used to sign double opt-in confirm links.
pub fn hmac_hex(secret: &str, message: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key size");
    mac.update(message.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Strips newlines from user-controlled values before logging.
pub fn sanitize(value: &str) -> String {
    value.replace(['\r', '\n'], "")
}

/// How far (seconds) the X-ElasticEmail-Timestamp may be from the current time.
pub const SIGNATURE_TOLERANCE_SECS: i64 = 300;

/// Checks an Elastic Email webhook signature:
/// hex(HMAC-SHA256(secret, timestamp + "\n" + METHOD + "\n" + target + "\n" + body)),
/// where target is the path and query exactly as received on the request line.
/// The signature header is a comma-separated list; any matching `v1=` entry is accepted.
pub fn verify_signature(
    secret: &str,
    timestamp: &str,
    signature: &str,
    method: &str,
    target: &str,
    body: &[u8],
    now: i64,
) -> bool {
    let Ok(ts) = timestamp.parse::<i64>() else { return false };
    if secret.is_empty() || (now - ts).abs() > SIGNATURE_TOLERANCE_SECS {
        return false;
    }
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key size");
    mac.update(format!("{}\n{}\n{}\n", timestamp, method, target).as_bytes());
    mac.update(body);
    let expected = hex::encode(mac.finalize().into_bytes());
    signature
        .split(',')
        .filter_map(|entry| entry.trim().strip_prefix("v1="))
        .any(|value| bool::from(value.as_bytes().ct_eq(expected.as_bytes())))
}

/// Authenticates an event notification and returns its fields under lower-cased names.
///
/// With a signing secret (ELASTICEMAIL_WEBHOOK_SECRET) the request must carry a valid signature;
/// without one it must carry `?token=` equal to `token`. Signed webhooks are usually POST with a
/// JSON body; GET webhooks carry the fields in the query string. `target` is the raw path and
/// query from the request line and `body` the raw bytes, read before any parsing. On failure it
/// returns the status and message to answer with (401 makes Elastic Email retry).
pub fn read_webhook(
    secret: &str,
    token: &str,
    method: &str,
    target: &str,
    header: impl Fn(&str) -> Option<String>,
    body: &[u8],
) -> Result<std::collections::HashMap<String, String>, (u16, &'static str)> {
    let query = target.split_once('?').map(|(_, q)| q).unwrap_or("");
    let query: Vec<(String, String)> = url::form_urlencoded::parse(query.as_bytes()).into_owned().collect();

    if !secret.is_empty() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let timestamp = header("X-ElasticEmail-Timestamp").unwrap_or_default();
        let signature = header("X-ElasticEmail-Signature").unwrap_or_default();
        if !verify_signature(secret, &timestamp, &signature, method, target, body, now) {
            return Err((401, "Invalid signature"));
        }
    } else {
        let given = query.iter().find(|(k, _)| k == "token").map(|(_, v)| v.as_str()).unwrap_or("");
        if !token_ok(given, token) {
            return Err((401, "Invalid token"));
        }
    }

    let mut event: std::collections::HashMap<String, String> =
        query.into_iter().map(|(k, v)| (k.to_lowercase(), v)).collect();
    let trimmed = std::str::from_utf8(body).map_err(|_| (400, "Invalid body"))?.trim();
    if trimmed.starts_with('{') {
        // PostJson: a flat object; to, from, channel, subject and messageid may be null.
        let fields: serde_json::Map<String, serde_json::Value> =
            serde_json::from_str(trimmed).map_err(|_| (400, "Invalid JSON body"))?;
        for (key, value) in fields {
            let value = match value {
                serde_json::Value::Null => String::new(),
                serde_json::Value::String(s) => s,
                other => other.to_string(),
            };
            event.insert(key.to_lowercase(), value);
        }
    } else if !trimmed.is_empty() {
        for (key, value) in url::form_urlencoded::parse(trimmed.as_bytes()) {
            event.insert(key.to_lowercase(), value.into_owned());
        }
    }
    Ok(event)
}
