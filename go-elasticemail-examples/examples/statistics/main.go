package main

import (
	"fmt"
	"time"

	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	// Account-wide sending statistics for the last 30 days.
	// The SDK serializes time.Time as RFC 3339; truncate to seconds so no
	// fractional part is sent (the API expects YYYY-MM-DDThh:mm:ss).
	to := time.Now().UTC().Truncate(time.Second)
	from := to.Add(-30 * 24 * time.Hour)

	stats, resp, err := client.StatisticsAPI.StatisticsGet(ctx).From(from).To(to).Execute()
	if err != nil {
		ee.Fail("fetch statistics", resp, err)
	}

	fmt.Printf("=== Statistics %s to %s ===\n", from.Format("2006-01-02T15:04:05"), to.Format("2006-01-02T15:04:05"))
	fmt.Println("Recipients:   ", stats.GetRecipients())
	fmt.Println("Emails total: ", stats.GetEmailTotal())
	fmt.Println("Delivered:    ", stats.GetDelivered())
	fmt.Println("Bounced:      ", stats.GetBounced())
	fmt.Println("In progress:  ", stats.GetInProgress())
	fmt.Println("Opened:       ", stats.GetOpened())
	fmt.Println("Clicked:      ", stats.GetClicked())
	fmt.Println("Unsubscribed: ", stats.GetUnsubscribed())
	fmt.Println("Complaints:   ", stats.GetComplaints())
}
