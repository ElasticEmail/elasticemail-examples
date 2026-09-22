package main

import (
	"fmt"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	html.SetContent("<h1>Welcome!</h1><p>This email was sent using the Elastic Email Go SDK.</p>")

	text := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_PLAIN_TEXT)
	text.SetContent("Welcome! This email was sent using the Elastic Email Go SDK.")

	content := ElasticEmail.NewEmailContent(ee.From())
	content.SetSubject("Hello from Elastic Email!")
	content.SetBody([]ElasticEmail.BodyPart{*html, *text})

	recipients := ElasticEmail.NewTransactionalRecipient([]string{ee.To()})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)

	result, resp, err := client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
	if err != nil {
		ee.Fail("send email", resp, err)
	}

	fmt.Println("Email sent successfully!")
	fmt.Println("Transaction ID:", result.GetTransactionID())
	fmt.Println("Message ID:", result.GetMessageID())
}
