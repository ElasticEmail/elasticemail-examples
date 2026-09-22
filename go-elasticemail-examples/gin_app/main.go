package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
	"github.com/gin-gonic/gin"
)

var (
	client *ElasticEmail.APIClient
	ctx    context.Context

	from               string
	contactEmail       string
	listName           string
	publicURL          string
	secret             string
	confirmRedirectURL string
)

var attachmentName = regexp.MustCompile(`^att\d+_name$`)

func main() {
	client, ctx = ee.NewClient()

	from = ee.From()
	contactEmail = ee.Env("CONTACT_EMAIL", from)
	listName = ee.Env("ELASTICEMAIL_LIST_NAME", "Newsletter")
	publicURL = ee.Env("PUBLIC_URL", "http://localhost:3001")
	secret = ee.Env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
	confirmRedirectURL = ee.Env("CONFIRM_REDIRECT_URL", "")

	r := gin.Default()
	// Elastic Email inbound notifications carry base64 attachments in the form body
	r.MaxMultipartMemory = 25 << 20

	r.GET("/health", healthHandler)
	r.POST("/send", sendHandler)
	r.GET("/webhook", webhookHandler)
	r.POST("/webhook", webhookHandler)
	r.POST("/inbound", inboundHandler)
	r.POST("/double-optin/subscribe", doubleOptinSubscribeHandler)
	r.GET("/double-optin/confirm", doubleOptinConfirmHandler)
	r.POST("/double-optin/webhook", doubleOptinWebhookHandler)

	port := ee.Env("PORT", "3001")
	fmt.Printf("Gin server running on http://localhost:%s\n", port)
	log.Fatal(r.Run(":" + port))
}

func apiErrorResponse(c *gin.Context, resp *http.Response, err error) {
	status, message := ee.APIError(resp, err)
	c.JSON(status, gin.H{"error": message})
}

// Strip newlines from user-controlled values before logging
func sanitize(value string) string {
	return strings.NewReplacer("\r", "", "\n", "").Replace(value)
}

// Constant-time comparison of the shared secret carried in ?token=
func tokenOk(token string) bool {
	return subtle.ConstantTimeCompare([]byte(token), []byte(secret)) == 1
}

func hmacHex(value string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func sendTransactional(to string, content *ElasticEmail.EmailContent) (*ElasticEmail.EmailSend, *http.Response, error) {
	recipients := ElasticEmail.NewTransactionalRecipient([]string{to})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)
	return client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
}

func healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func sendHandler(c *gin.Context) {
	var body struct {
		To      string `json:"to"`
		Subject string `json:"subject"`
		Message string `json:"message"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if body.To == "" || body.Subject == "" || body.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: to, subject, message"})
		return
	}

	part := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	part.SetContent("<p>" + body.Message + "</p>")

	content := ElasticEmail.NewEmailContent(from)
	content.SetSubject(body.Subject)
	content.SetBody([]ElasticEmail.BodyPart{*part})

	sent, resp, err := sendTransactional(body.To, content)
	if err != nil {
		apiErrorResponse(c, resp, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"transactionId": sent.GetTransactionID(),
		"messageId":     sent.GetMessageID(),
	})
}

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
func webhookHandler(c *gin.Context) {
	if !tokenOk(c.Query("token")) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	// Request.FormValue reads both the query string and the form-encoded body.
	r := c.Request
	status := sanitize(r.FormValue("status"))

	if status == "" {
		// Validation ping or empty request
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	log.Printf("Webhook event: %s to: %s transaction: %s", status, sanitize(r.FormValue("to")), sanitize(r.FormValue("transaction")))

	switch status {
	case "Sent":
		log.Println("Email sent, message id:", sanitize(r.FormValue("messageid")))
	case "Opened":
		log.Println("Email opened from", sanitize(r.FormValue("Country")), sanitize(r.FormValue("City")))
	case "Clicked":
		log.Println("Link clicked:", sanitize(r.FormValue("target")))
	case "Error":
		log.Println("Bounce/error, category:", sanitize(r.FormValue("category")))
	case "AbuseReport":
		log.Println("Complaint received")
	case "Unsubscribed":
		log.Println("Recipient unsubscribed")
	}

	c.JSON(http.StatusOK, gin.H{"received": true, "status": status})
}

// Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
func inboundHandler(c *gin.Context) {
	if !tokenOk(c.Query("token")) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form body"})
		return
	}
	form := c.Request.PostForm

	var attachments []ElasticEmail.MessageAttachment
	var names []string
	for key := range form {
		if !attachmentName.MatchString(key) {
			continue
		}
		name := form.Get(key)
		content := form.Get(strings.Replace(key, "_name", "_content", 1))
		names = append(names, name)
		if content != "" {
			attachments = append(attachments, *ElasticEmail.NewMessageAttachment(content, name))
		}
	}

	fromEmail := form.Get("from_email")
	subject := form.Get("subject")
	log.Printf("Inbound email from: %s subject: %s", sanitize(fromEmail), sanitize(subject))
	if len(names) == 0 {
		log.Println("Attachments: none")
	} else {
		log.Println("Attachments:", strings.Join(names, ", "))
	}

	// Forward a copy to the team inbox
	bodyHTML := form.Get("body_html")
	if bodyHTML == "" {
		bodyHTML = "<pre>" + html.EscapeString(form.Get("body_text")) + "</pre>"
	}
	if subject == "" {
		subject = "(no subject)"
	}

	part := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	part.SetContent(bodyHTML)

	content := ElasticEmail.NewEmailContent(from)
	content.SetSubject("Fwd: " + subject)
	content.SetBody([]ElasticEmail.BodyPart{*part})
	if fromEmail != "" {
		content.SetReplyTo(fromEmail)
	}
	if len(attachments) > 0 {
		content.SetAttachments(attachments)
	}

	sent, resp, err := sendTransactional(contactEmail, content)
	if err != nil {
		apiErrorResponse(c, resp, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"received": true, "forwardedMessageId": sent.GetMessageID()})
}

func doubleOptinSubscribeHandler(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if body.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required field: email"})
		return
	}

	confirmURL := fmt.Sprintf("%s/double-optin/confirm?email=%s&token=%s", publicURL, url.QueryEscape(body.Email), hmacHex(body.Email))
	greeting := "Welcome!"
	if body.Name != "" {
		greeting = fmt.Sprintf("Welcome, %s!", body.Name)
	}

	// Stored as Transactional so it receives the confirmation but no campaigns yet
	contact := ElasticEmail.NewContactPayload(body.Email)
	firstName := ""
	if parts := strings.Fields(body.Name); len(parts) > 0 {
		firstName = parts[0]
	}
	contact.SetFirstName(firstName)
	contact.SetStatus(ElasticEmail.CONTACTSTATUS_TRANSACTIONAL)

	_, resp, err := client.ContactsAPI.ContactsPost(ctx).ContactPayload([]ElasticEmail.ContactPayload{*contact}).Execute()
	if err != nil {
		apiErrorResponse(c, resp, err)
		return
	}

	part := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	part.SetContent(fmt.Sprintf(`<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>%s</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="%s" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>`, greeting, confirmURL))

	content := ElasticEmail.NewEmailContent(from)
	content.SetSubject("Confirm your subscription")
	content.SetBody([]ElasticEmail.BodyPart{*part})

	sent, resp, err := sendTransactional(body.Email, content)
	if err != nil {
		apiErrorResponse(c, resp, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Confirmation email sent",
		"messageId": sent.GetMessageID(),
	})
}

func doubleOptinConfirmHandler(c *gin.Context) {
	email := c.Query("email")
	token := c.Query("token")

	if email == "" || subtle.ConstantTimeCompare([]byte(hmacHex(email)), []byte(token)) != 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid confirmation link"})
		return
	}

	payload := ElasticEmail.NewEmailsPayload()
	payload.SetEmails([]string{email})

	_, resp, err := client.ListsAPI.ListsByNameContactsPost(ctx, listName).EmailsPayload(*payload).Execute()
	if err != nil {
		apiErrorResponse(c, resp, err)
		return
	}

	if confirmRedirectURL != "" {
		c.Redirect(http.StatusFound, confirmRedirectURL)
		return
	}
	c.JSON(http.StatusOK, gin.H{"confirmed": true, "email": email, "list": listName})
}

// Click-tracking based confirmation: create a webhook for Clicked events pointing here.
func doubleOptinWebhookHandler(c *gin.Context) {
	if !tokenOk(c.Query("token")) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	r := c.Request
	status := r.FormValue("status")
	target := r.FormValue("target")
	recipient := r.FormValue("to")

	if status != "Clicked" || !strings.Contains(target, "/double-optin/confirm") {
		c.JSON(http.StatusOK, gin.H{"received": true, "status": sanitize(status), "message": "Event ignored"})
		return
	}

	payload := ElasticEmail.NewEmailsPayload()
	payload.SetEmails([]string{recipient})

	_, resp, err := client.ListsAPI.ListsByNameContactsPost(ctx, listName).EmailsPayload(*payload).Execute()
	if err != nil {
		apiErrorResponse(c, resp, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"received": true, "confirmed": true, "email": sanitize(recipient)})
}
