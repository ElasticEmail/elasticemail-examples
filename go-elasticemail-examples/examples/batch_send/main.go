package main

import (
	"fmt"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func recipient(email string, fields map[string]string) ElasticEmail.EmailRecipient {
	r := ElasticEmail.NewEmailRecipient(email)
	r.SetFields(fields)
	return *r
}

func main() {
	client, ctx := ee.NewClient()
	to := ee.To()

	// Bulk send: one API call, one personalized email per recipient.
	// Values from Recipients[].Fields replace {placeholders} in the body.
	// Up to 1000 recipients per request.
	recipients := []ElasticEmail.EmailRecipient{
		recipient(to, map[string]string{"firstname": "Ann", "plan": "Pro"}),
		recipient(to, map[string]string{"firstname": "Ben", "plan": "Starter"}),
		recipient(to, map[string]string{"firstname": "Cleo", "plan": "Team"}),
	}

	html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	html.SetContent("<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>")

	text := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_PLAIN_TEXT)
	text.SetContent("Hi {firstname}! Your {plan} plan is now active.")

	content := ElasticEmail.NewEmailContent(ee.From())
	content.SetSubject("Hi {firstname}, your {plan} plan is ready")
	content.SetBody([]ElasticEmail.BodyPart{*html, *text})

	data := ElasticEmail.NewEmailMessageData(recipients, *content)

	result, resp, err := client.EmailsAPI.EmailsPost(ctx).EmailMessageData(*data).Execute()
	if err != nil {
		ee.Fail("send bulk email", resp, err)
	}

	fmt.Printf("Bulk email queued for %d recipients.\n", len(recipients))
	fmt.Println("Transaction ID:", result.GetTransactionID())
	fmt.Println("Check delivery with: go run ./examples/email_status/", result.GetTransactionID())
}
