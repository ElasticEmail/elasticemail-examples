package main

import (
	"fmt"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

// Minimal 1x1 PNG placeholder (base64-encoded)
const placeholderImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

func main() {
	client, ctx := ee.NewClient()

	// Elastic Email derives the Content-ID of an attachment from its file name.
	// Reference the attachment Name after "cid:" to embed it inline.
	html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	html.SetContent(`<div style="font-family: Arial, sans-serif; padding: 20px;">
  <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
  <h1>Welcome!</h1>
  <p>This email contains an inline image referenced by Content-ID.</p>
</div>`)

	attachment := ElasticEmail.NewMessageAttachment(placeholderImage, "logo.png")
	attachment.SetContentType("image/png")

	content := ElasticEmail.NewEmailContent(ee.From())
	content.SetSubject("Email with Inline Image")
	content.SetBody([]ElasticEmail.BodyPart{*html})
	content.SetAttachments([]ElasticEmail.MessageAttachment{*attachment})

	recipients := ElasticEmail.NewTransactionalRecipient([]string{ee.To()})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)

	result, resp, err := client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
	if err != nil {
		ee.Fail("send email", resp, err)
	}

	fmt.Println("Email with inline image sent successfully!")
	fmt.Println("Transaction ID:", result.GetTransactionID())
	fmt.Println("Message ID:", result.GetMessageID())
}
