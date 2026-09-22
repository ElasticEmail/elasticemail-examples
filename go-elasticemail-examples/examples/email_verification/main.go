package main

import (
	"fmt"
	"os"

	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	// Usage: go run ./examples/email_verification/ someone@example.com
	email := ee.To()
	if len(os.Args) > 1 {
		email = os.Args[1]
	}

	// Email verification is a paid feature. Accounts without it get a 4xx here.
	_, resp, err := client.VerificationsAPI.VerificationsByEmailPost(ctx, email).Execute()
	if err != nil {
		ee.Fail("start verification", resp, err)
	}

	result, resp, err := client.VerificationsAPI.VerificationsByEmailGet(ctx, email).Execute()
	if err != nil {
		ee.Fail("get verification", resp, err)
	}

	fmt.Println("=== Verification result ===")
	fmt.Println("Email:      ", result.GetEmail())
	fmt.Println("Result:     ", result.GetResult())
	fmt.Println("Reason:     ", result.GetReason())
	fmt.Println("Disposable: ", result.GetDisposable())
	fmt.Println("Role:       ", result.GetRole())
	if s := result.GetSuggestedSpelling(); s != "" {
		fmt.Println("Did you mean:", s)
	}
}
