# API map

Every SDK in this repository is generated from the same OpenAPI description, so one operation has one
name in five spellings. Learn the rule once and the table below is readable in any language.

## Naming rule

| Language | Spelling | Example |
|---|---|---|
| TypeScript / JavaScript | `camelCase` | `emailsApi.emailsTransactionalPost(...)` |
| PHP | `camelCase` | `$emailsApi->emailsTransactionalPost(...)` |
| Java | `camelCase` | `emailsApi.emailsTransactionalPost(...)` |
| Python | `snake_case` | `emails_api.emails_transactional_post(...)` |
| Ruby | `snake_case` | `emails_api.emails_transactional_post(...)` |
| Rust | `snake_case`, free function in a module | `emails_api::emails_transactional_post(&config, data)` |
| Go | `PascalCase`, builder then `.Execute()` | `client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()` |
| C# | `PascalCase` + `Async` | `await emailsApi.EmailsTransactionalPostAsync(...)` |
| Elixir | no SDK - the REST path directly | `ElasticEmail.post("/emails/transactional", body)` |

## API classes

| Area | TS / PHP / Java / C# | Python / Ruby | Go | Rust module |
|---|---|---|---|---|
| Sending, status | `EmailsApi` | `EmailsApi` | `EmailsAPI` | `emails_api` |
| Contacts | `ContactsApi` | `ContactsApi` | `ContactsAPI` | `contacts_api` |
| Lists | `ListsApi` | `ListsApi` | `ListsAPI` | `lists_api` |
| Templates | `TemplatesApi` | `TemplatesApi` | `TemplatesAPI` | `templates_api` |
| Domains | `DomainsApi` | `DomainsApi` | `DomainsAPI` | `domains_api` |
| Webhooks | `WebhookApi` | `WebhookApi` | `WebhookAPI` | `webhook_api` |
| Inbound routes | `InboundRouteApi` | `InboundRouteApi` | `InboundRouteAPI` | `inbound_route_api` |
| Suppressions | `SuppressionsApi` | `SuppressionsApi` | `SuppressionsAPI` | `suppressions_api` |
| Statistics | `StatisticsApi` | `StatisticsApi` | `StatisticsAPI` | `statistics_api` |
| Verifications | `VerificationsApi` | `VerificationsApi` | `VerificationsAPI` | `verifications_api` |
| Sub-accounts | `SubAccountsApi` | `SubAccountsApi` | `SubAccountsAPI` | `sub_accounts_api` |

## Operations

`camelCase` is the TypeScript, PHP and Java name. `snake_case` is Python, Ruby and Rust. `PascalCase`
is Go, and C# with `Async` appended.

### Sending

| Use case | REST | camelCase | snake_case | PascalCase |
|---|---|---|---|---|
| Transactional send | `POST /emails/transactional` | `emailsTransactionalPost` | `emails_transactional_post` | `EmailsTransactionalPost` |
| Bulk send | `POST /emails` | `emailsPost` | `emails_post` | `EmailsPost` |
| Transaction status | `GET /emails/{transactionid}/status` | `emailsByTransactionidStatusGet` | `emails_by_transactionid_status_get` | `EmailsByTransactionidStatusGet` |
| View a message | `GET /emails/{msgid}/view` | `emailsByMsgidViewGet` | `emails_by_msgid_view_get` | `EmailsByMsgidViewGet` |

### Templates

| Use case | REST | camelCase | snake_case | PascalCase |
|---|---|---|---|---|
| Get by name | `GET /templates/{name}` | `templatesByNameGet` | `templates_by_name_get` | `TemplatesByNameGet` |
| Create | `POST /templates` | `templatesPost` | `templates_post` | `TemplatesPost` |

### Contacts and lists

| Use case | REST | camelCase | snake_case | PascalCase |
|---|---|---|---|---|
| Create contacts | `POST /contacts` | `contactsPost` | `contacts_post` | `ContactsPost` |
| Get a contact | `GET /contacts/{email}` | `contactsByEmailGet` | `contacts_by_email_get` | `ContactsByEmailGet` |
| Update a contact | `PUT /contacts/{email}` | `contactsByEmailPut` | `contacts_by_email_put` | `ContactsByEmailPut` |
| Delete a contact | `DELETE /contacts/{email}` | `contactsByEmailDelete` | `contacts_by_email_delete` | `ContactsByEmailDelete` |
| Create a list | `POST /lists` | `listsPost` | `lists_post` | `ListsPost` |
| Contacts on a list | `GET /lists/{listname}/contacts` | `listsByListnameContactsGet` | `lists_by_listname_contacts_get` | `ListsByListnameContactsGet` |
| Add to a list | `POST /lists/{name}/contacts` | `listsByNameContactsPost` | `lists_by_name_contacts_post` | `ListsByNameContactsPost` |

### Domains

| Use case | REST | camelCase | snake_case | PascalCase |
|---|---|---|---|---|
| List domains | `GET /domains` | `domainsGet` | `domains_get` | `DomainsGet` |
| Add a domain | `POST /domains` | `domainsPost` | `domains_post` | `DomainsPost` |
| Domain details | `GET /domains/{domain}` | `domainsByDomainGet` | `domains_by_domain_get` | `DomainsByDomainGet` |
| Verify tracking | `PUT /domains/{domain}/verification` | `domainsByDomainVerificationPut` | `domains_by_domain_verification_put` | `DomainsByDomainVerificationPut` |
| Set default sender | `PATCH /domains/{email}/default` | `domainsByEmailDefaultPatch` | `domains_by_email_default_patch` | `DomainsByEmailDefaultPatch` |

### Webhooks and inbound

| Use case | REST | camelCase | snake_case | PascalCase |
|---|---|---|---|---|
| Create a webhook | `POST /webhook` | `webhookPost` | `webhook_post` | `WebhookPost` |
| List webhooks | `GET /webhook` | `webhookGet` | `webhook_get` | `WebhookGet` |
| Delete a webhook | `DELETE /webhook/{publicid}` | `webhookByPublicidDelete` | `webhook_by_publicid_delete` | `WebhookByPublicidDelete` |
| Create a route | `POST /inboundroute` | `inboundroutePost` | `inboundroute_post` | `InboundroutePost` |
| List routes | `GET /inboundroute` | `inboundrouteGet` | `inboundroute_get` | `InboundrouteGet` |
| Delete a route | `DELETE /inboundroute/{id}` | `inboundrouteByIdDelete` | `inboundroute_by_id_delete` | `InboundrouteByIdDelete` |

### Suppressions

| Use case | REST | camelCase | snake_case | PascalCase |
|---|---|---|---|---|
| Add unsubscribes | `POST /suppressions/unsubscribes` | `suppressionsUnsubscribesPost` | `suppressions_unsubscribes_post` | `SuppressionsUnsubscribesPost` |
| List | `GET /suppressions` | `suppressionsGet` | `suppressions_get` | `SuppressionsGet` |
| Get one | `GET /suppressions/{email}` | `suppressionsByEmailGet` | `suppressions_by_email_get` | `SuppressionsByEmailGet` |
| Remove one | `DELETE /suppressions/{email}` | `suppressionsByEmailDelete` | `suppressions_by_email_delete` | `SuppressionsByEmailDelete` |

### Account

| Use case | REST | camelCase | snake_case | PascalCase |
|---|---|---|---|---|
| Statistics | `GET /statistics` | `statisticsGet` | `statistics_get` | `StatisticsGet` |
| Start verification | `POST /verifications/{email}` | `verificationsByEmailPost` | `verifications_by_email_post` | `VerificationsByEmailPost` |
| Verification result | `GET /verifications/{email}` | `verificationsByEmailGet` | `verifications_by_email_get` | `VerificationsByEmailGet` |
| List sub-accounts | `GET /subaccounts` | `subaccountsGet` | `subaccounts_get` | `SubaccountsGet` |
| Create a sub-account | `POST /subaccounts` | `subaccountsPost` | `subaccounts_post` | `SubaccountsPost` |
| Assign credits | `PATCH /subaccounts/{email}/credits` | `subaccountsByEmailCreditsPatch` | `subaccounts_by_email_credits_patch` | `SubaccountsByEmailCreditsPatch` |
| Get its API key | `GET /subaccounts/{email}/apikey` | `subaccountsByEmailApikeyGet` | `subaccounts_by_email_apikey_get` | `SubaccountsByEmailApikeyGet` |

## Model field casing

The wire format is PascalCase (`Recipients`, `Content`, `BinaryContent`, `TimeOffset`). The SDKs
differ in what they expect from you:

| Language | Field names in your code |
|---|---|
| TypeScript / JavaScript | PascalCase, same as the wire |
| Python | PascalCase on constructors (`ContentType=`, `From=`), snake_case on responses (`result.transaction_id`) |
| Ruby, PHP, Rust | snake_case (`content_type`, `binary_content`, `time_offset`) |
| Java, C# | camelCase builders and constructor arguments (`.contentType(...)`, `binaryContent:`) |
| Go | `SetContentType`, `SetBinaryContent`, `GetTransactionID` |
| Elixir | PascalCase strings, exactly as the API reference lists them |

## Authentication

Header `X-ElasticEmail-ApiKey`, set once when you build the client.

| Language | How |
|---|---|
| TypeScript | `new Configuration({ apiKey })` |
| Python | `configuration.api_key["apikey"] = key` |
| Ruby | `config.api_key["X-ElasticEmail-ApiKey"] = key` |
| PHP | `Configuration::getDefaultConfiguration()->setApiKey('X-ElasticEmail-ApiKey', $key)` |
| Go | key in the context: `context.WithValue(ctx, ElasticEmail.ContextAPIKeys, map[string]ElasticEmail.APIKey{"apikey": {Key: key}})` |
| Java | `((ApiKeyAuth) client.getAuthentication("apikey")).setApiKey(key)` |
| C# | `config.AddApiKey("X-ElasticEmail-ApiKey", key)` |
| Rust | `Configuration { api_key: Some(ApiKey { prefix: None, key }), ..Default::default() }` |
| Elixir | `Req.new(headers: [{"X-ElasticEmail-ApiKey", key}])` |
