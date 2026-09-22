use rust_elasticemail_examples::{config, env_or, from, is_not_found, print_api_error, to};
use std::collections::HashMap;
use ElasticEmail::apis::configuration::Configuration;
use ElasticEmail::apis::{emails_api, templates_api};
use ElasticEmail::models::{
    BodyContentType, BodyPart, EmailContent, EmailTransactionalMessageData, TemplatePayload, TemplateScope,
    TransactionalRecipient,
};

// Templates are referenced by name. Create it on first run.
async fn ensure_template(config: &Configuration, name: &str) -> bool {
    match templates_api::templates_by_name_get(config, name).await {
        Ok(_) => {
            println!("Template \"{}\" already exists.", name);
            true
        }
        Err(e) if is_not_found(&e) => {
            let payload = TemplatePayload {
                subject: Some("Welcome, {firstname}!".to_string()),
                body: Some(vec![BodyPart {
                    content: Some("<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>".to_string()),
                    ..BodyPart::new(BodyContentType::Html)
                }]),
                template_scope: Some(TemplateScope::Personal),
                ..TemplatePayload::new(name.to_string())
            };
            match templates_api::templates_post(config, payload).await {
                Ok(_) => {
                    println!("Template \"{}\" created.", name);
                    true
                }
                Err(e) => {
                    print_api_error("create template", &e);
                    false
                }
            }
        }
        Err(e) => {
            print_api_error("get template", &e);
            false
        }
    }
}

#[tokio::main]
async fn main() {
    let config = config();
    let template_name = env_or("ELASTICEMAIL_TEMPLATE_NAME", "welcome-example");

    if !ensure_template(&config, &template_name).await {
        std::process::exit(1);
    }

    // Merge values replace {placeholders} in the template subject and body.
    let merge = HashMap::from([
        ("firstname".to_string(), "Ann".to_string()),
        ("company".to_string(), "Acme".to_string()),
    ]);
    let content = EmailContent {
        template_name: Some(template_name),
        merge: Some(merge),
        ..EmailContent::new(from())
    };

    let data = EmailTransactionalMessageData::new(TransactionalRecipient::new(vec![to()]), content);

    match emails_api::emails_transactional_post(&config, data).await {
        Ok(result) => {
            println!("Template email sent successfully!");
            println!("Transaction ID: {}", result.transaction_id.unwrap_or_default());
            println!("Message ID: {}", result.message_id.unwrap_or_default());
        }
        Err(e) => {
            print_api_error("sending email", &e);
            std::process::exit(1);
        }
    }
}
