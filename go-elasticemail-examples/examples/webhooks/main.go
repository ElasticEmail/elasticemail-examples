package main

import (
	"fmt"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	publicURL := ee.Env("PUBLIC_URL", "http://localhost:3000")

	// Signed webhooks: Elastic Email POSTs each event as JSON and signs it with HMAC-SHA256
	// (X-ElasticEmail-Signature). The handler verifies the signature with the secret returned
	// below, so the URL needs no ?token=. Signing and the delivery method can't be changed later.
	webhookURL := publicURL + "/webhook"

	// 1. Create. Elastic Email sends a test request to the URL on save, so the handler must be
	//    reachable (use a tunnel such as ngrok for local development). The handler doesn't know the
	//    secret yet and answers 401, which Elastic Email accepts for that test.
	payload := ElasticEmail.NewWebhookCreatePayload("examples-webhook", webhookURL)
	payload.SetNotifyOncePerEmail(false)
	payload.SetNotificationForSent(true)
	payload.SetNotificationForOpened(true)
	payload.SetNotificationForClicked(true)
	payload.SetNotificationForUnsubscribed(true)
	payload.SetNotificationForAbuseReport(true)
	payload.SetNotificationForError(true)
	payload.SetEnableSigning(true)
	payload.SetDeliveryMethod(ElasticEmail.WEBHOOKDELIVERYMETHOD_POST_JSON)

	created, resp, err := client.WebhookAPI.WebhookPost(ctx).WebhookCreatePayload(*payload).Execute()
	if err != nil {
		ee.Fail("create webhook", resp, err)
	}
	webhookID := created.GetWebhookID()
	fmt.Println("Webhook created:", webhookID, created.GetURL())
	// The secret is returned only here. Store it as ELASTICEMAIL_WEBHOOK_SECRET.
	fmt.Println("Signing secret (shown once, store it as ELASTICEMAIL_WEBHOOK_SECRET):", created.GetSigningSecret())

	// 2. List
	webhooks, resp, err := client.WebhookAPI.WebhookGet(ctx).Limit(50).Offset(0).Execute()
	if err != nil {
		ee.Fail("list webhooks", resp, err)
	}
	fmt.Printf("\nWebhooks (%d):\n", len(webhooks))
	for _, w := range webhooks {
		fmt.Printf(" - %s %s %s enabled=%t\n", w.GetWebhookID(), w.GetName(), w.GetURL(), w.GetIsEnabled())
	}

	// 3. Rotate the signing secret. The old one stops working at once (no grace period).
	if webhookID != "" {
		rotated, resp, err := client.WebhookAPI.WebhookByPublicidSecretRotatePost(ctx, webhookID).Execute()
		if err != nil {
			ee.Fail("rotate webhook secret", resp, err)
		}
		fmt.Println("\nNew signing secret (store it as ELASTICEMAIL_WEBHOOK_SECRET):", rotated.GetSigningSecret())
	}

	// 4. Delete the one we created (comment out to keep it)
	if webhookID != "" {
		resp, err := client.WebhookAPI.WebhookByPublicidDelete(ctx, webhookID).Execute()
		if err != nil {
			ee.Fail("delete webhook", resp, err)
		}
		fmt.Println("\nWebhook deleted:", webhookID)
	}
}
