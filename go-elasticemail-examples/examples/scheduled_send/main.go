package main

import (
	"fmt"
	"time"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	// TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
	// Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
	const delayMinutes int32 = 60
	scheduledFor := time.Now().UTC().Add(time.Duration(delayMinutes) * time.Minute).Format(time.RFC3339)

	html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	html.SetContent(fmt.Sprintf("<h1>Scheduled Email</h1><p>This email was scheduled for %s.</p>", scheduledFor))

	content := ElasticEmail.NewEmailContent(ee.From())
	content.SetSubject("Scheduled Email")
	content.SetBody([]ElasticEmail.BodyPart{*html})

	options := ElasticEmail.NewOptions()
	options.SetTimeOffset(delayMinutes)

	recipients := ElasticEmail.NewTransactionalRecipient([]string{ee.To()})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)
	data.SetOptions(*options)

	result, resp, err := client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
	if err != nil {
		ee.Fail("schedule email", resp, err)
	}

	fmt.Println("Email scheduled for", scheduledFor)
	fmt.Println("Transaction ID:", result.GetTransactionID())
	fmt.Println("Message ID:", result.GetMessageID())
}
