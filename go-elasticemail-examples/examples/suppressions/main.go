package main

import (
	"fmt"
	"os"

	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	email := "suppressed@example.com"
	if len(os.Args) > 1 {
		email = os.Args[1]
	}

	// Suppressions are split into unsubscribes, bounces and complaints.
	// Adding to any list stops future sends to that address.
	_, resp, err := client.SuppressionsAPI.SuppressionsUnsubscribesPost(ctx).RequestBody([]string{email}).Execute()
	if err != nil {
		ee.Fail("add unsubscribe", resp, err)
	}
	fmt.Println("Added to unsubscribes:", email)

	s, resp, err := client.SuppressionsAPI.SuppressionsByEmailGet(ctx, email).Execute()
	if err != nil {
		ee.Fail("get suppression", resp, err)
	}
	dateUpdated := ""
	if s.DateUpdated.IsSet() && s.DateUpdated.Get() != nil {
		dateUpdated = s.GetDateUpdated().String()
	}
	fmt.Printf("Suppression: email=%s reason=%q dateUpdated=%s\n", s.GetEmail(), s.GetFriendlyErrorMessage(), dateUpdated)

	all, resp, err := client.SuppressionsAPI.SuppressionsGet(ctx).Limit(10).Offset(0).Execute()
	if err != nil {
		ee.Fail("list suppressions", resp, err)
	}
	fmt.Printf("\nAll suppressions (first %d):\n", len(all))
	for _, item := range all {
		fmt.Printf(" - %s %s\n", item.GetEmail(), item.GetFriendlyErrorMessage())
	}

	// Remove it again so the address can receive email
	resp, err = client.SuppressionsAPI.SuppressionsByEmailDelete(ctx, email).Execute()
	if err != nil {
		ee.Fail("delete suppression", resp, err)
	}
	fmt.Println("\nRemoved from suppressions:", email)
}
