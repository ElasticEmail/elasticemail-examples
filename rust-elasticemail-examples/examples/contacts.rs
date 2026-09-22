use rust_elasticemail_examples::{already_exists, config, env_or, print_api_error, to};
use std::collections::HashMap;
use ElasticEmail::apis::{contacts_api, lists_api};
use ElasticEmail::models::{ContactPayload, ContactStatus, ContactUpdatePayload, ListPayload};

#[tokio::main]
async fn main() {
    let config = config();
    let list_name = env_or("ELASTICEMAIL_LIST_NAME", "Newsletter");
    let email = to();

    // 1. Create a list (Elastic Email lists are addressed by name, not by id)
    let list = ListPayload { allow_unsubscribe: Some(true), ..ListPayload::new(list_name.clone()) };
    match lists_api::lists_post(&config, list).await {
        Ok(_) => println!("List \"{}\" created.", list_name),
        Err(e) if already_exists(&e) => println!("List \"{}\" already exists.", list_name),
        Err(e) => {
            print_api_error("create list", &e);
            std::process::exit(1);
        }
    }

    // 2. Add a contact and put it on the list in one call
    let payload = ContactPayload {
        first_name: Some("Ann".to_string()),
        last_name: Some("Example".to_string()),
        status: Some(ContactStatus::Active),
        // only existing custom fields are saved
        custom_fields: Some(HashMap::from([("plan".to_string(), "Pro".to_string())])),
        ..ContactPayload::new(email.clone())
    };
    match contacts_api::contacts_post(&config, vec![payload], Some(vec![list_name.clone()])).await {
        Ok(contacts) => {
            let c = contacts.first();
            println!(
                "Contact added: {} status: {:?}",
                c.and_then(|c| c.email.clone()).unwrap_or_default(),
                c.and_then(|c| c.status)
            );
        }
        Err(e) => {
            print_api_error("add contact", &e);
            std::process::exit(1);
        }
    }

    // 3. Read it back
    match contacts_api::contacts_by_email_get(&config, &email).await {
        Ok(c) => println!(
            "Contact: email={} first_name={} status={:?} source={:?}",
            c.email.unwrap_or_default(),
            c.first_name.unwrap_or_default(),
            c.status,
            c.source
        ),
        Err(e) => {
            print_api_error("get contact", &e);
            std::process::exit(1);
        }
    }

    // 4. Update
    let update = ContactUpdatePayload { first_name: Some("Anna".to_string()), ..ContactUpdatePayload::new() };
    match contacts_api::contacts_by_email_put(&config, &email, update).await {
        Ok(c) => println!("Contact updated. FirstName: {}", c.first_name.unwrap_or_default()),
        Err(e) => {
            print_api_error("update contact", &e);
            std::process::exit(1);
        }
    }

    // 5. List contacts on the list
    match lists_api::lists_by_listname_contacts_get(&config, &list_name, Some(10), Some(0)).await {
        Ok(contacts) => {
            println!("Contacts in \"{}\" (first {}):", list_name, contacts.len());
            for c in contacts {
                println!(" - {} {:?}", c.email.unwrap_or_default(), c.status);
            }
        }
        Err(e) => {
            print_api_error("list contacts", &e);
            std::process::exit(1);
        }
    }

    // 6. Delete the contact (uncomment to clean up)
    // contacts_api::contacts_by_email_delete(&config, &email).await.unwrap();
    // println!("Contact deleted.");

    println!("\nDone.");
}
