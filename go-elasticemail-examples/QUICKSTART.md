# Send your first email with Go

Five minutes from a clean clone to a delivered email, using the Elastic Email Go SDK. Works plain,
with Chi or with Gin.

## Prerequisites

- Go 1.22+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

Creating and managing keys is covered in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/go-elasticemail-examples

go mod tidy
cp .env.example .env
```

In a project of your own:

```bash
go get github.com/elasticemail/elasticemail-go/v4
go get github.com/joho/godotenv
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

`godotenv.Load()` reads the file from the **current working directory**, so run the commands below
from this folder. Full list in
[docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

The API key travels in the context, not in the configuration struct:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	ctx := context.WithValue(context.Background(), ElasticEmail.ContextAPIKeys,
		map[string]ElasticEmail.APIKey{"apikey": {Key: os.Getenv("ELASTICEMAIL_API_KEY")}})

	client := ElasticEmail.NewAPIClient(ElasticEmail.NewConfiguration())

	html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	html.SetContent("<h1>Welcome!</h1><p>Sent from Go.</p>")

	text := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_PLAIN_TEXT)
	text.SetContent("Welcome! Sent from Go.")

	content := ElasticEmail.NewEmailContent(os.Getenv("EMAIL_FROM"))
	content.SetSubject("Hello from Elastic Email!")
	content.SetBody([]ElasticEmail.BodyPart{*html, *text})

	recipients := ElasticEmail.NewTransactionalRecipient([]string{os.Getenv("EMAIL_TO")})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)

	result, resp, err := client.EmailsAPI.
		EmailsTransactionalPost(ctx).
		EmailTransactionalMessageData(*data).
		Execute()
	if err != nil {
		log.Fatalf("send failed: %d %v", resp.StatusCode, err)
	}

	fmt.Println("Transaction ID:", result.GetTransactionID())
}
```

Three things to notice: the API key rides in the context, calls are a builder chain ending in
`.Execute()`, and every call returns `(result, *http.Response, error)` - the response carries the
status, the error carries the body.

Run the version in this repository:

```bash
go run ./examples/basic_send/
```

`internal/ee` holds the shared setup: `NewClient()`, `From()`, `To()`, `Fail()` and `APIError()`.

## 6. Or run a web app

```bash
go run ./chi_app/     # Chi, http://localhost:3000
go run ./gin_app/     # Gin, http://localhost:3001
```

The Gin app defaults to 3001 so both can run side by side. Set `PORT` to change either.

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Go!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## Handling failures

```go
result, resp, err := client.EmailsAPI.EmailsTransactionalPost(ctx).
	EmailTransactionalMessageData(*data).Execute()
if err != nil {
	status, message := ee.APIError(resp, err)   // parses {"Error": "..."} out of the body
}
```

`resp` is nil on a transport failure, which is why `ee.StatusCode()` guards for it. See
[Error handling](../docs/error-handling.md).

## Next steps

```bash
go run ./examples/batch_send/             # one call, personalized per recipient
go run ./examples/with_attachments/       # base64 file attachment
go run ./examples/with_cid_attachments/   # inline image via cid:
go run ./examples/with_template/          # hosted template + merge values
go run ./examples/webhooks/               # create, list, delete a webhook
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every program and route | [README.md](README.md) |
