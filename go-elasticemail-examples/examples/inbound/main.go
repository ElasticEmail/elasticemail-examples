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
	domain := ee.Env("SENDING_DOMAIN", "yourdomain.com")

	// Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
	// Matching emails are parsed and POSTed as form fields to HttpAddress
	// (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
	// See chi_app/main.go or gin_app/main.go for the receiving handler.
	payload := ElasticEmail.NewInboundPayload(
		"*@"+domain,
		"examples-inbound",
		ElasticEmail.INBOUNDROUTEFILTERTYPE_EMAIL_ADDRESS,
		ElasticEmail.INBOUNDROUTEACTIONTYPE_NOTIFY_VIA_HTTP,
	)
	payload.SetHttpAddress(publicURL + "/inbound?token=" + url.QueryEscape(token))

	created, resp, err := client.InboundRouteAPI.InboundroutePost(ctx).InboundPayload(*payload).Execute()
	if err != nil {
		ee.Fail("create route", resp, err)
	}
	routeID := created.GetPublicId()
	fmt.Println("Inbound route created:", routeID, created.GetFilter(), "->", created.GetActionParameter())

	routes, resp, err := client.InboundRouteAPI.InboundrouteGet(ctx).Execute()
	if err != nil {
		ee.Fail("list routes", resp, err)
	}
	fmt.Printf("\nInbound routes (%d):\n", len(routes))
	for _, r := range routes {
		fmt.Printf(" - [%d] %s %s: %s=%s %s %s\n",
			r.GetSortOrder(), r.GetPublicId(), r.GetName(), r.GetFilterType(), r.GetFilter(), r.GetActionType(), r.GetActionParameter())
	}

	// Delete the route we created (comment out to keep it)
	if routeID != "" {
		resp, err := client.InboundRouteAPI.InboundrouteByIdDelete(ctx, routeID).Execute()
		if err != nil {
			ee.Fail("delete route", resp, err)
		}
		fmt.Println("\nInbound route deleted:", routeID)
	}
}
