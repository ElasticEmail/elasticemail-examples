package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func okOrMissing(v bool) string {
	if v {
		return "ok"
	}
	return "missing"
}

func yesOrNo(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}

func main() {
	client, ctx := ee.NewClient()
	domain := ee.Env("SENDING_DOMAIN", "yourdomain.com")

	// 1. Add the domain
	payload := ElasticEmail.NewDomainPayload()
	payload.SetDomain(domain)

	_, resp, err := client.DomainsAPI.DomainsPost(ctx).DomainPayload(*payload).Execute()
	if err != nil {
		body := strings.ToLower(ee.ErrorBody(err))
		if ee.StatusCode(resp) == http.StatusBadRequest && (strings.Contains(body, "exist") || strings.Contains(body, "already")) {
			fmt.Printf("Domain %q already exists.\n", domain)
		} else {
			ee.Fail("add domain", resp, err)
		}
	} else {
		fmt.Printf("Domain %q added.\n", domain)
	}

	// 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
	info, resp, err := client.DomainsAPI.DomainsByDomainGet(ctx, domain).Execute()
	if err != nil {
		ee.Fail("get domain", resp, err)
	}
	fmt.Println("\nVerification status:")
	fmt.Println("  SPF:      ", okOrMissing(info.GetSpf()))
	fmt.Println("  DKIM:     ", okOrMissing(info.GetDkim()))
	fmt.Println("  MX:       ", okOrMissing(info.GetMX()))
	fmt.Println("  DMARC:    ", okOrMissing(info.GetDMARC()))
	tracking := string(info.GetTrackingStatus())
	if tracking == "" {
		tracking = "n/a"
	}
	fmt.Println("  Tracking: ", tracking)
	fmt.Println("  Default:  ", yesOrNo(info.GetDefaultDomain()))
	if info.HasDKIMRecord() {
		record, _ := json.Marshal(info.GetDKIMRecord())
		fmt.Println("\nDKIM record to publish:", string(record))
	}

	// 3. List all domains
	domains, resp, err := client.DomainsAPI.DomainsGet(ctx).Execute()
	if err != nil {
		ee.Fail("list domains", resp, err)
	}
	fmt.Printf("\nDomains on the account (%d):\n", len(domains))
	for _, d := range domains {
		fmt.Printf(" - %s spf=%t dkim=%t default=%t\n", d.GetDomain(), d.GetSpf(), d.GetDkim(), d.GetDefaultDomain())
	}

	// 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
	// client.DomainsAPI.DomainsByDomainVerificationPut(ctx, domain).Body("Http").Execute()

	// 5. Optional: set the default sender for the account
	// client.DomainsAPI.DomainsByEmailDefaultPatch(ctx, "hello@"+domain).Execute()

	fmt.Println("\nDone.")
}
