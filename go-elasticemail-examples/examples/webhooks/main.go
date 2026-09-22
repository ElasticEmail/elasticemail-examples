package main

import (
	"fmt"
	"net/url"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	publicURL := ee.Env("PUBLIC_URL", "http://localhost:3000")
	token := ee.Env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")

	// Elastic Email does not sign webhook requests. The examples append a shared secret
	// as a query parameter and the receiving handler checks it.
	webhookURL := publicURL + "/webhook?token=" + url.QueryEscape(token)

	// 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
	//    and answer 2xx (use a tunnel such as ngrok for local development).
	payload := ElasticEmail.NewWebhookCreatePayload("examples-webhook", webhookURL)
	payload.SetNotifyOncePerEmail(false)
	payload.SetNotificationForSent(true)
	payload.SetNotificationForOpened(true)
	payload.SetNotificationForClicked(true)
	payload.SetNotificationForUnsubscribed(true)
	payload.SetNotificationForAbuseReport(true)
	payload.SetNotificationForError(true)

	created, resp, err := client.WebhookAPI.WebhookPost(ctx).WebhookCreatePayload(*payload).Execute()
	if err != nil {
		ee.Fail("create webhook", resp, err)
	}
	webhookID := created.GetWebhookID()
	fmt.Println("Webhook created:", webhookID, created.GetURL())

	// 2. List
	webhooks, resp, err := client.WebhookAPI.WebhookGet(ctx).Limit(50).Offset(0).Execute()
	if err != nil {
		ee.Fail("list webhooks", resp, err)
	}
	fmt.Printf("\nWebhooks (%d):\n", len(webhooks))
	for _, w := range webhooks {
		fmt.Printf(" - %s %s %s enabled=%t\n", w.GetWebhookID(), w.GetName(), w.GetURL(), w.GetIsEnabled())
	}

	// 3. Delete the one we created (comment out to keep it)
	if webhookID != "" {
		resp, err := client.WebhookAPI.WebhookByPublicidDelete(ctx, webhookID).Execute()
		if err != nil {
			ee.Fail("delete webhook", resp, err)
		}
		fmt.Println("\nWebhook deleted:", webhookID)
	}
}
