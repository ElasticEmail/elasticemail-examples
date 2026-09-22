package main

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

// Alternative confirmation flow driven by Elastic Email click tracking.
// Create a webhook (see examples/webhooks) pointing at POST /double-optin/webhook.
// When the recipient clicks the confirm link, Elastic Email reports status=Clicked
// with the clicked URL in "target". The contact is then added to the list.

var expectedToken string

func tokenOk(token string) bool {
	return subtle.ConstantTimeCompare([]byte(token), []byte(expectedToken)) == 1
}

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

	http.HandleFunc("/double-optin/webhook", func(w http.ResponseWriter, r *http.Request) {
		if !tokenOk(r.URL.Query().Get("token")) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid token"})
			return
		}

		// Elastic Email validates the URL with a GET when the webhook is saved.
		if r.Method == http.MethodGet {
			writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
			return
		}
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
			return
		}

		// Parameters arrive in the query string or as form fields; FormValue checks both.
		if err := r.ParseForm(); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid form body"})
			return
		}
		status := sanitize(r.FormValue("status"))
		target := sanitize(r.FormValue("target"))
		recipient := sanitize(r.FormValue("to"))

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
