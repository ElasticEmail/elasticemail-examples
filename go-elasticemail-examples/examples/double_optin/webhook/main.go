package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see examples/webhooks) pointing at /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.

var (
	expectedToken string
	webhookSecret string
)

func sanitize(value string) string {
	return strings.NewReplacer("\r", "", "\n", "").Replace(value)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	client, ctx := ee.NewClient()

	listName := ee.Env("ELASTICEMAIL_LIST_NAME", "Newsletter")
	expectedToken = ee.Env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
	webhookSecret = ee.Env("ELASTICEMAIL_WEBHOOK_SECRET", "")

	http.HandleFunc("/double-optin/webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
			return
		}

		// Signed webhooks (POST + JSON) are verified with ELASTICEMAIL_WEBHOOK_SECRET;
		// unsigned ones (GET + query string) with ?token=ELASTICEMAIL_WEBHOOK_TOKEN.
		event, code, message := ee.ReadWebhook(r, webhookSecret, expectedToken)
		if event == nil {
			writeJSON(w, code, map[string]string{"error": message})
			return
		}
		status := sanitize(event.Get("status"))
		target := sanitize(event.Get("target"))
		recipient := sanitize(event.Get("to"))

		// Test request sent when the webhook is saved.
		if status == "" {
			writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
			return
		}

		if status != "Clicked" || !strings.Contains(target, "/double-optin/confirm") {
			writeJSON(w, http.StatusOK, map[string]interface{}{"received": true, "status": status, "message": "Event ignored"})
			return
		}

		payload := ElasticEmail.NewEmailsPayload()
		payload.SetEmails([]string{recipient})

		_, resp, err := client.ListsAPI.ListsByNameContactsPost(ctx, listName).EmailsPayload(*payload).Execute()
		if err != nil {
			ee.PrintAPIError("add contact to list", resp, err)
			code, message := ee.APIError(resp, err)
			writeJSON(w, code, map[string]string{"error": message})
			return
		}

		log.Println("Subscription confirmed via click:", recipient)
		writeJSON(w, http.StatusOK, map[string]interface{}{"received": true, "confirmed": true, "email": recipient, "list": listName})
	})

	port := ee.Env("PORT", "3000")
	fmt.Printf("Double opt-in webhook listening on http://localhost:%s/double-optin/webhook\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
