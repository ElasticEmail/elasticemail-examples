use rust_elasticemail_examples::{config, env_or, print_api_error};
use ElasticEmail::apis::inbound_route_api;
use ElasticEmail::models::{InboundPayload, InboundRouteActionType, InboundRouteFilterType};

#[tokio::main]
async fn main() {
    let config = config();
    let public_url = env_or("PUBLIC_URL", "http://localhost:3000");
    let token = env_or("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");
    let domain = env_or("SENDING_DOMAIN", "yourdomain.com");

    // Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
    // Matching emails are parsed and POSTed as form fields to HttpAddress
    // (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
    // See axum_app/src/main.rs for the receiving handler.
    let payload = InboundPayload {
        http_address: Some(format!("{}/inbound?token={}", public_url, urlencoding::encode(&token))),
        ..InboundPayload::new(
            format!("*@{}", domain),
            "examples-inbound".to_string(),
            InboundRouteFilterType::EmailAddress,
            InboundRouteActionType::NotifyViaHttp,
        )
    };
    let route_id = match inbound_route_api::inboundroute_post(&config, payload).await {
        Ok(r) => {
            println!(
                "Inbound route created: {} {} -> {}",
                r.public_id.clone().unwrap_or_default(),
                r.filter.unwrap_or_default(),
                r.action_parameter.unwrap_or_default()
            );
            r.public_id
        }
        Err(e) => {
            print_api_error("create route", &e);
            std::process::exit(1);
        }
    };

    match inbound_route_api::inboundroute_get(&config).await {
        Ok(routes) => {
            println!("\nInbound routes ({}):", routes.len());
            for r in routes {
                println!(
                    " - [{}] {} {}: {:?}={} {:?} {}",
                    r.sort_order.unwrap_or(0),
                    r.public_id.unwrap_or_default(),
                    r.name.unwrap_or_default(),
                    r.filter_type,
                    r.filter.unwrap_or_default(),
                    r.action_type,
                    r.action_parameter.unwrap_or_default()
                );
            }
        }
        Err(e) => {
            print_api_error("list routes", &e);
            std::process::exit(1);
        }
    }

    // Delete the route we created (comment out to keep it)
    if let Some(id) = route_id {
        match inbound_route_api::inboundroute_by_id_delete(&config, &id).await {
            Ok(_) => println!("\nInbound route deleted: {}", id),
            Err(e) => {
                print_api_error("delete route", &e);
                std::process::exit(1);
            }
        }
    }
}
