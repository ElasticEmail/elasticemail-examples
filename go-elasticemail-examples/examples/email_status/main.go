package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	// Usage: go run ./examples/email_status/ <transactionId> [messageId]
	// Both ids are returned by every send call.
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: go run ./examples/email_status/ <transactionId> [messageId]")
		os.Exit(1)
	}
	transactionID := os.Args[1]
	messageID := ""
	if len(os.Args) > 2 {
		messageID = os.Args[2]
	}

	client, ctx := ee.NewClient()

	status, resp, err := client.EmailsAPI.EmailsByTransactionidStatusGet(ctx, transactionID).
		ShowFailed(true).
		ShowSent(true).
		ShowDelivered(true).
		ShowPending(true).
		ShowOpened(true).
		ShowClicked(true).
		Execute()
	if err != nil {
		ee.Fail("fetch status", resp, err)
	}

	fmt.Println("=== Transaction status ===")
	fmt.Println("Status:     ", status.GetStatus())
	fmt.Println("Recipients: ", status.GetRecipientsCount())
	fmt.Println("Sent:       ", status.GetSentCount(), status.GetSent())
	fmt.Println("Delivered:  ", status.GetDeliveredCount(), status.GetDelivered())
	fmt.Println("Pending:    ", status.GetPendingCount())
	fmt.Println("Opened:     ", status.GetOpenedCount())
	fmt.Println("Clicked:    ", status.GetClickedCount())
	failed := make([]string, 0, len(status.GetFailed()))
	for _, f := range status.GetFailed() {
		failed = append(failed, fmt.Sprintf("%s (%s)", f.GetAddress(), f.GetError()))
	}
	fmt.Println("Failed:     ", status.GetFailedCount(), failed)

	if messageID == "" {
		return
	}

	msg, resp, err := client.EmailsAPI.EmailsByMsgidViewGet(ctx, messageID).Execute()
	if err != nil {
		ee.PrintAPIError("fetch message", resp, err)
		return
	}

	preview := msg.GetPreview()
	state := msg.GetStatus()
	fmt.Println("\n=== Message ===")
	fmt.Println("From:    ", preview.GetFrom())
	fmt.Println("Subject: ", preview.GetSubject())
	dateSent := ""
	if state.DateSent != nil {
		dateSent = state.GetDateSent().String()
	}
	fmt.Println("Status:  ", state.GetStatusName(), dateSent)
	body := strings.TrimSpace(preview.GetBody())
	if len(body) > 200 {
		body = body[:200] + "..."
	}
	fmt.Println("Body preview:", body)
}
