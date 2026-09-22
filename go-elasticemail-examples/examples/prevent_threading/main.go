package main

import (
	"crypto/rand"
	"fmt"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

// newUUID returns a random RFC 4122 version 4 UUID without pulling in a dependency.
func newUUID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func main() {
	client, ctx := ee.NewClient()

	// Gmail groups emails into threads based on subject and Message-ID/References headers.
	// A unique X-Entity-Ref-ID header per email prevents this grouping.
	for i := 1; i <= 3; i++ {
		html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
		html.SetContent(fmt.Sprintf("<h1>Order Confirmation</h1><p>This is email #%d. Each appears as a separate conversation in Gmail.</p>", i))

		content := ElasticEmail.NewEmailContent(ee.From())
		content.SetSubject("Order Confirmation") // Same subject for all
		content.SetBody([]ElasticEmail.BodyPart{*html})
		content.SetHeaders(map[string]string{"X-Entity-Ref-ID": newUUID()})

		recipients := ElasticEmail.NewTransactionalRecipient([]string{ee.To()})
		data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)

		result, resp, err := client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
		if err != nil {
			ee.Fail(fmt.Sprintf("send email #%d", i), resp, err)
		}

		fmt.Printf("Email #%d sent: %s\n", i, result.GetMessageID())
	}

	fmt.Println("\nAll emails sent with unique X-Entity-Ref-ID headers.")
}
