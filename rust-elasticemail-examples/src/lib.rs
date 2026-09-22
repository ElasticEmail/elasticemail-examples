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
