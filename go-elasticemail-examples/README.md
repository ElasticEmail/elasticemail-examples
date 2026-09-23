# Go Email API Examples - Elastic Email

Send transactional and bulk email from Go with the [Elastic Email](https://elasticemail.com/email-api) email API. Standalone programs plus two HTTP servers - Chi and Gin - built on the official Elastic Email Go SDK.

> **First time here?** The [Go quickstart](QUICKSTART.md) gets you from nothing to a delivered email in five minutes.
> For the concepts behind these examples, see the [Elastic Email guides](../docs/README.md).

## Prerequisites

- Go 1.22+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Installation

```bash
# Download dependencies
go mod tidy

# Copy environment variables
cp .env.example .env

# Add your Elastic Email API key to .env
```

## Standalone Examples

Run every program from this folder. Each one reads `.env` from the current directory.

### Basic Email Sending
```bash
go run ./examples/basic_send/
```

### Batch Sending
```bash
go run ./examples/batch_send/
```

### With Attachments
```bash
go run ./examples/with_attachments/
```

### With CID (Inline) Attachments
```bash
go run ./examples/with_cid_attachments/
```

### Using Templates
```bash
go run ./examples/with_template/
```

### Scheduled Sending
```bash
go run ./examples/scheduled_send/
```

### Prevent Gmail Threading
```bash
go run ./examples/prevent_threading/
```

### Contacts and Lists
```bash
go run ./examples/contacts/
```

### Domain Management
```bash
go run ./examples/domains/
```

### Email Status
```bash
go run ./examples/email_status/ <transactionId> [messageId]
```

### Webhooks
```bash
go run ./examples/webhooks/
```

### Inbound Routes
```bash
go run ./examples/inbound/
```

### Double Opt-In
```bash
# Subscribe (creates contact + sends confirmation)
go run ./examples/double_optin/subscribe/ user@example.com "John Doe"

# Click-tracking based confirmation server (net/http)
go run ./examples/double_optin/webhook/
```

### Suppressions
```bash
go run ./examples/suppressions/ [email]
```

### Email Verification
```bash
go run ./examples/email_verification/ someone@example.com
```

### Statistics
```bash
go run ./examples/statistics/
```

### Sub-Accounts
```bash
go run ./examples/sub_accounts/
# Creating a sub-account affects billing:
CREATE_SUBACCOUNT=true go run ./examples/sub_accounts/
```

## Chi Application

```bash
go run ./chi_app/

# Then in another terminal:
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Chi!"}'
```

## Gin Application

```bash
go run ./gin_app/

# Then in another terminal:
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Gin!"}'
```

The Gin app listens on 3001 by default so both servers can run side by side. Set `PORT` to change it.

## API Endpoints

Both server apps expose the same routes and JSON shapes.

- `GET /health` -> `{"status": "ok"}`
- `POST /send` body `{"to", "subject", "message"}` -> `{"success": true, "transactionId", "messageId"}`
- `GET|POST /webhook?token=...` - Elastic Email event notifications. Elastic Email sends each event as a GET request with the details in the query string (`status`, `to`, `transaction`, `messageid`, `target`, ...). The `token` must match `ELASTICEMAIL_WEBHOOK_TOKEN`.
- `POST /inbound?token=...` - inbound email pushed by an inbound route (`from_email`, `subject`, `body_html`, `att1_name`, `att1_content`, ...). Forwards a copy to `CONTACT_EMAIL`.
- `POST /double-optin/subscribe` body `{"email", "name"}` - stores the contact as Transactional and sends a confirmation link
- `GET /double-optin/confirm?email=&token=` - verifies the HMAC token and adds the contact to `ELASTICEMAIL_LIST_NAME`
- `POST /double-optin/webhook?token=...` - confirms on a `Clicked` event whose `target` is the confirm link

Failures return `{"error": "<message from the API>"}` with the API status code.

## Quick Usage

```go
package main

import (
	"context"
	"fmt"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
)

func main() {
	ctx := context.WithValue(context.Background(), ElasticEmail.ContextAPIKeys,
		map[string]ElasticEmail.APIKey{"apikey": {Key: "your_api_key"}})
	client := ElasticEmail.NewAPIClient(ElasticEmail.NewConfiguration())

	body := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	body.SetContent("<p>Hello World</p>")

	content := ElasticEmail.NewEmailContent("Acme <hello@yourdomain.com>")
	content.SetSubject("Hello")
	content.SetBody([]ElasticEmail.BodyPart{*body})

	recipients := ElasticEmail.NewTransactionalRecipient([]string{"you@yourdomain.com"})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)

	result, _, err := client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
	if err != nil {
		panic(err)
	}
	fmt.Println(result.GetTransactionID(), result.GetMessageID())
}
```

## Project Structure

```
go-elasticemail-examples/
├── internal/ee/ee.go                  # Shared config (API key context, env values, error printing)
├── examples/
│   ├── basic_send/main.go             # Simple transactional email
│   ├── batch_send/main.go             # Bulk send with merge fields
│   ├── with_attachments/main.go       # Emails with files
│   ├── with_cid_attachments/main.go   # Inline images
│   ├── with_template/main.go          # Templates with merge values
│   ├── scheduled_send/main.go         # Delayed delivery (TimeOffset)
│   ├── prevent_threading/main.go      # Prevent Gmail threading
│   ├── contacts/main.go               # Contacts and lists
│   ├── domains/main.go                # Domain verification
│   ├── email_status/main.go           # Delivery status by transaction id
│   ├── webhooks/main.go               # Manage webhooks
│   ├── inbound/main.go                # Manage inbound routes
│   ├── double_optin/
│   │   ├── subscribe/main.go          # Double opt-in: subscribe
│   │   └── webhook/main.go            # Double opt-in: click-based confirm server
│   ├── suppressions/main.go           # Unsubscribes, bounces, complaints
│   ├── email_verification/main.go     # Verify an address
│   ├── statistics/main.go             # Account statistics
│   └── sub_accounts/main.go           # Sub-accounts (read-only by default)
├── chi_app/main.go                    # Chi web application
├── gin_app/main.go                    # Gin web application
├── go.mod
├── .env.example
└── README.md
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email Go SDK](https://github.com/ElasticEmail/elasticemail-go)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Elastic Email Developers](https://elasticemail.com/developers)

## License

MIT
