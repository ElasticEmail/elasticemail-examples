// Package ee holds the configuration shared by every example: env loading,
// the Elastic Email client with its API key context, and error printing.
package ee

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/joho/godotenv"
)

// LoadEnv reads .env from the current directory if present. Missing file is fine.
func LoadEnv() {
	_ = godotenv.Load()
}

// Env returns the variable value or the fallback when unset or empty.
func Env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// NewClient builds the API client and the context carrying the API key.
// The SDK reads the key from the context on every request and sends it as
// the X-ElasticEmail-ApiKey header.
func NewClient() (*ElasticEmail.APIClient, context.Context) {
	LoadEnv()

	apiKey := os.Getenv("ELASTICEMAIL_API_KEY")
	if apiKey == "" {
		log.Fatal("ELASTICEMAIL_API_KEY environment variable is required. Get a key at https://app.elasticemail.com/marketing/settings/new/manage-api")
	}

	ctx := context.WithValue(
		context.Background(),
		ElasticEmail.ContextAPIKeys,
		map[string]ElasticEmail.APIKey{
			"apikey": {Key: apiKey},
		},
	)

	client := ElasticEmail.NewAPIClient(ElasticEmail.NewConfiguration())
	return client, ctx
}

// From is the verified sender address.
func From() string {
	return Env("EMAIL_FROM", "Acme <hello@yourdomain.com>")
}

// To is the test recipient.
func To() string {
	return Env("EMAIL_TO", "you@yourdomain.com")
}

// ErrorBody extracts the raw response body from an SDK error. The API answers
// failures with {"Error": "message"}; the SDK keeps that body on GenericOpenAPIError.
func ErrorBody(err error) string {
	var apiErr *ElasticEmail.GenericOpenAPIError
	if errors.As(err, &apiErr) {
		body := strings.TrimSpace(string(apiErr.Body()))
		if body != "" {
			return body
		}
	}
	if err != nil {
		return err.Error()
	}
	return ""
}

// StatusCode returns the HTTP status of a response, or 0 when there is none.
func StatusCode(resp *http.Response) int {
	if resp == nil {
		return 0
	}
	return resp.StatusCode
}

// PrintAPIError writes "Error (<step>): <status> <body>" to stderr.
func PrintAPIError(step string, resp *http.Response, err error) {
	fmt.Fprintf(os.Stderr, "Error (%s): %d %s\n", step, StatusCode(resp), ErrorBody(err))
}

// Fail prints the error and exits with status 1.
func Fail(step string, resp *http.Response, err error) {
	PrintAPIError(step, resp, err)
	os.Exit(1)
}

// APIError maps an SDK failure to an HTTP status and a message for JSON responses.
// The status is taken from the API response (500 when there was none) and the
// message from the "Error" field of the body, falling back to the raw body.
func APIError(resp *http.Response, err error) (int, string) {
	status := StatusCode(resp)
	if status == 0 {
		status = http.StatusInternalServerError
	}

	body := ErrorBody(err)
	var parsed struct {
		Error string `json:"Error"`
	}
	if json.Unmarshal([]byte(body), &parsed) == nil && parsed.Error != "" {
		return status, parsed.Error
	}
	if body == "" {
		body = "Unknown error"
	}
	return status, body
}

// Elastic Email treats {...} and {{...}} in message content as template syntax,
// so strip braces from user input.
var htmlEscaper = strings.NewReplacer(
	"&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&#39;", "{", "&#123;", "}", "&#125;",
)

// EscapeHTML escapes a user-supplied value for an HTML body, braces included.
func EscapeHTML(s string) string {
	return htmlEscaper.Replace(s)
}

// PlainText removes braces from a user-supplied value for PlainText bodies and contact fields.
func PlainText(s string) string {
	return strings.NewReplacer("{", "", "}", "").Replace(s)
}

// HeaderText is PlainText without CR and LF, for Subject and other header-like fields.
func HeaderText(s string) string {
	return strings.NewReplacer("\r", "", "\n", "").Replace(PlainText(s))
}

// EscapeBraces turns braces into HTML entities and leaves the rest of the HTML untouched.
func EscapeBraces(s string) string {
	return strings.NewReplacer("{", "&#123;", "}", "&#125;").Replace(s)
}

// ValidAddress checks the shape of a bare address: exactly one @ and no whitespace.
func ValidAddress(email string) bool {
	return strings.Count(email, "@") == 1 && strings.IndexFunc(email, unicode.IsSpace) < 0
}

func domainOf(email string) string {
	at := strings.LastIndex(email, "@")
	if at < 0 {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(strings.TrimRight(email[at+1:], "> ")))
}

// AllowedDomains is EMAIL_ALLOWED_DOMAINS, or the domain of EMAIL_TO when that is empty.
func AllowedDomains() []string {
	var domains []string
	for _, d := range strings.Split(os.Getenv("EMAIL_ALLOWED_DOMAINS"), ",") {
		if d = strings.ToLower(strings.TrimSpace(d)); d != "" {
			domains = append(domains, d)
		}
	}
	if len(domains) == 0 {
		if d := domainOf(os.Getenv("EMAIL_TO")); d != "" {
			domains = append(domains, d)
		}
	}
	return domains
}

// RecipientAllowed reports whether POST /send may deliver to this address.
func RecipientAllowed(email string) bool {
	if !ValidAddress(email) {
		return false
	}
	domain := domainOf(email)
	for _, d := range AllowedDomains() {
		if d == domain {
			return true
		}
	}
	return false
}

// BearerOk checks "Authorization: Bearer <token>" with a constant-time compare.
func BearerOk(header, token string) bool {
	const prefix = "Bearer "
	if token == "" || !strings.HasPrefix(header, prefix) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(header[len(prefix):]), []byte(token)) == 1
}

// ConfirmToken signs a double opt-in link: HMAC-SHA256(secret, email + "\n" + expires) as hex.
func ConfirmToken(secret, email string, expires int64) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s\n%d", email, expires)))
	return hex.EncodeToString(mac.Sum(nil))
}

// ConfirmURL builds a confirm link that expires after 48 hours.
func ConfirmURL(publicURL, secret, email string) string {
	expires := time.Now().Add(48 * time.Hour).Unix()
	return fmt.Sprintf("%s/double-optin/confirm?email=%s&expires=%d&token=%s",
		publicURL, url.QueryEscape(email), expires, ConfirmToken(secret, email, expires))
}

// RateLimiter counts hits per key in fixed windows.
// In-memory limits are per process; use a shared store (Redis, the platform's rate limiter) in production.
type RateLimiter struct {
	Max    int
	Window time.Duration

	mu      sync.Mutex
	windows map[string]rateWindow
}

type rateWindow struct {
	count   int
	resetAt time.Time
}

// Allow records a hit and returns false plus the seconds until the window resets when over the limit.
func (l *RateLimiter) Allow(key string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.windows == nil {
		l.windows = map[string]rateWindow{}
	}
	now := time.Now()
	w, ok := l.windows[key]
	if !ok || !now.Before(w.resetAt) {
		w = rateWindow{resetAt: now.Add(l.Window)}
	}
	w.count++
	l.windows[key] = w
	if w.count > l.Max {
		return false, int(math.Ceil(w.resetAt.Sub(now).Seconds()))
	}
	return true, 0
}

// CheckStartup logs the /send state and refuses to expose the placeholder webhook token publicly.
func CheckStartup(webhookToken string) {
	if os.Getenv("ELASTICEMAIL_SEND_TOKEN") == "" {
		log.Println("POST /send is disabled until ELASTICEMAIL_SEND_TOKEN is set")
	}
	CheckWebhookToken(webhookToken)
}

// CheckWebhookToken warns about the placeholder token locally and exits when PUBLIC_URL is public.
func CheckWebhookToken(webhookToken string) {
	if webhookToken != "" && webhookToken != "change_me" {
		return
	}
	publicURL := os.Getenv("PUBLIC_URL")
	host := ""
	if u, err := url.Parse(publicURL); err == nil {
		host = u.Hostname()
	}
	if publicURL == "" || host == "localhost" || host == "127.0.0.1" || host == "::1" {
		log.Println("ELASTICEMAIL_WEBHOOK_TOKEN is the placeholder; fine for local testing only")
		return
	}
	log.Fatalf("Refusing to start: set ELASTICEMAIL_WEBHOOK_TOKEN before exposing webhooks at %s", publicURL)
}
