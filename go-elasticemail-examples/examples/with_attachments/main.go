package main

import (
	"encoding/base64"
	"fmt"
	"time"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	fileContent := fmt.Sprintf("Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: %s\n", time.Now().UTC().Format(time.RFC3339))
	encoded := base64.StdEncoding.EncodeToString([]byte(fileContent))

	html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	html.SetContent("<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>")

	// BinaryContent is base64. Total message size limit applies (see account limits).
	attachment := ElasticEmail.NewMessageAttachment(encoded, "sample.txt")
	attachment.SetContentType("text/plain")

	content := ElasticEmail.NewEmailContent(ee.From())
	content.SetSubject("Email with Attachment")
	content.SetBody([]ElasticEmail.BodyPart{*html})
	content.SetAttachments([]ElasticEmail.MessageAttachment{*attachment})

	recipients := ElasticEmail.NewTransactionalRecipient([]string{ee.To()})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)

	result, resp, err := client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
	if err != nil {
		ee.Fail("send email", resp, err)
	}

	fmt.Println("Email with attachment sent successfully!")
	fmt.Println("Transaction ID:", result.GetTransactionID())
	fmt.Println("Message ID:", result.GetMessageID())
}
