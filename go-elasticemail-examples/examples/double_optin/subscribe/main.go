package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"strings"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	// Usage: go run ./examples/double_optin/subscribe/ user@example.com "John Doe"
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, `Usage: go run ./examples/double_optin/subscribe/ <email> ["Name"]`)
		os.Exit(1)
	}
	email := os.Args[1]
	name := ""
	if len(os.Args) > 2 {
		name = os.Args[2]
	}

	client, ctx := ee.NewClient()

	publicURL := ee.Env("PUBLIC_URL", "http://localhost:3000")
	secret := ee.Env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")

	// The confirm link carries an HMAC of the email so the confirm endpoint can trust it.
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(email))
	confirmToken := hex.EncodeToString(mac.Sum(nil))
	confirmURL := fmt.Sprintf("%s/double-optin/confirm?email=%s&token=%s", publicURL, url.QueryEscape(email), confirmToken)

	// Step 1: store the contact without adding it to the marketing list.
	// Status "Transactional" allows sending the confirmation but excludes it from campaigns.
	parts := strings.Fields(name)
	contact := ElasticEmail.NewContactPayload(email)
	if len(parts) > 0 {
		contact.SetFirstName(parts[0])
		contact.SetLastName(strings.Join(parts[1:], " "))
	} else {
		contact.SetFirstName("")
		contact.SetLastName("")
	}
	contact.SetStatus(ElasticEmail.CONTACTSTATUS_TRANSACTIONAL)

	_, resp, err := client.ContactsAPI.ContactsPost(ctx).ContactPayload([]ElasticEmail.ContactPayload{*contact}).Execute()
	if err != nil {
		ee.Fail("store contact", resp, err)
	}
	fmt.Println("Contact stored (unconfirmed):", email)

	// Step 2: send the confirmation email
	greeting := "Welcome!"
	if name != "" {
		greeting = fmt.Sprintf("Welcome, %s!", name)
	}

	html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	html.SetContent(fmt.Sprintf(`<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>%s</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="%s" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>`, greeting, confirmURL))

	text := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_PLAIN_TEXT)
	text.SetContent(fmt.Sprintf("%s\n\nConfirm your subscription: %s", greeting, confirmURL))

	content := ElasticEmail.NewEmailContent(ee.From())
	content.SetSubject("Confirm your subscription")
	content.SetBody([]ElasticEmail.BodyPart{*html, *text})

	recipients := ElasticEmail.NewTransactionalRecipient([]string{email})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)

	result, resp, err := client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
	if err != nil {
		ee.Fail("send confirmation", resp, err)
	}

	fmt.Println("Confirmation email sent. Message ID:", result.GetMessageID())
	fmt.Println("Confirm URL:", confirmURL)
	fmt.Println("\nWhen the link is opened, GET /double-optin/confirm in chi_app or gin_app adds the contact to the list.")
}
