// Package ee holds the configuration shared by every example: env loading,
// the Elastic Email client with its API key context, and error printing.
package ee

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

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
