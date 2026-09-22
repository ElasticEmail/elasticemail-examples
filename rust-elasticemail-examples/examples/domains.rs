use rust_elasticemail_examples::{already_exists, config, env_or, print_api_error};
use ElasticEmail::apis::domains_api;
use ElasticEmail::models::DomainPayload;

fn flag(value: Option<bool>) -> &'static str {
    if value.unwrap_or(false) { "ok" } else { "missing" }
}

#[tokio::main]
async fn main() {
    let config = config();
    let domain = env_or("SENDING_DOMAIN", "yourdomain.com");

    // 1. Add the domain
    let payload = DomainPayload { domain: Some(domain.clone()), ..DomainPayload::new() };
    match domains_api::domains_post(&config, payload).await {
        Ok(_) => println!("Domain \"{}\" added.", domain),
        Err(e) if already_exists(&e) => println!("Domain \"{}\" already exists.", domain),
        Err(e) => {
            print_api_error("add domain", &e);
            std::process::exit(1);
        }
    }

    // 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
    match domains_api::domains_by_domain_get(&config, &domain).await {
        Ok(d) => {
            println!("\nVerification status:");
            println!("  SPF:       {}", flag(d.spf));
            println!("  DKIM:      {}", flag(d.dkim));
            println!("  MX:        {}", flag(d.mx));
            println!("  DMARC:     {}", flag(d.dmarc));
            println!("  Tracking:  {}", d.tracking_status.map(|s| format!("{:?}", s)).unwrap_or_else(|| "n/a".into()));
            println!("  Default:   {}", if d.default_domain.unwrap_or(false) { "yes" } else { "no" });
            if let Some(record) = d.dkim_record {
                println!("\nDKIM record to publish: {}", serde_json::to_string(&record).unwrap_or_default());
            }
        }
        Err(e) => {
            print_api_error("get domain", &e);
            std::process::exit(1);
        }
    }

    // 3. List all domains
    match domains_api::domains_get(&config).await {
        Ok(domains) => {
            println!("\nDomains on the account ({}):", domains.len());
            for d in domains {
                println!(
                    " - {} spf={} dkim={} default={}",
                    d.domain.unwrap_or_default(),
                    d.spf.unwrap_or(false),
                    d.dkim.unwrap_or(false),
                    d.default_domain.unwrap_or(false)
                );
            }
        }
        Err(e) => {
            print_api_error("list domains", &e);
            std::process::exit(1);
        }
    }

    // 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
    // domains_api::domains_by_domain_verification_put(&config, &domain, "Http").await.unwrap();

    // 5. Optional: set the default sender for the account
    // domains_api::domains_by_email_default_patch(&config, &format!("hello@{}", domain)).await.unwrap();

    println!("\nDone.");
}
