package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

func main() {
	client, ctx := ee.NewClient()

	// Sub-accounts let you isolate customers or projects with their own API keys and credits.
	// Creating one affects billing, so this program only reads unless CREATE_SUBACCOUNT=true.
	createEnabled := os.Getenv("CREATE_SUBACCOUNT") == "true"
	subEmail := ee.Env("SUBACCOUNT_EMAIL", fmt.Sprintf("sub-%d@example.com", time.Now().UnixMilli()))

	accounts, resp, err := client.SubAccountsAPI.SubaccountsGet(ctx).Limit(20).Offset(0).Execute()
	if err != nil {
		ee.Fail("list sub-accounts", resp, err)
	}
	fmt.Printf("Sub-accounts (%d):\n", len(accounts))
	for _, s := range accounts {
		fmt.Printf(" - %s status=%s credits=%d sent=%d\n", s.GetEmail(), s.GetStatus(), s.GetEmailCredits(), s.GetTotalEmailsSent())
	}

	if !createEnabled {
		fmt.Println("\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.")
		return
	}

	payload := ElasticEmail.NewSubaccountPayload(subEmail, "Tmp-"+randomHex(8)+"-Aa1!")
	payload.SetSendActivation(false)

	created, resp, err := client.SubAccountsAPI.SubaccountsPost(ctx).SubaccountPayload(*payload).Execute()
	if err != nil {
		ee.Fail("create sub-account", resp, err)
	}
	fmt.Println("\nSub-account created:", created.GetEmail())

	credits := ElasticEmail.NewSubaccountEmailCreditsPayload(1000)
	credits.SetNotes("Initial allocation")

	resp, err = client.SubAccountsAPI.SubaccountsByEmailCreditsPatch(ctx, subEmail).SubaccountEmailCreditsPayload(*credits).Execute()
	if err != nil {
		ee.Fail("assign credits", resp, err)
	}
	fmt.Println("Assigned 1000 credits to", subEmail)

	key, resp, err := client.SubAccountsAPI.SubaccountsByEmailApikeyGet(ctx, subEmail).Execute()
	if err != nil {
		ee.Fail("get sub-account api key", resp, err)
	}
	fmt.Println("Sub-account API key retrieved (length):", len(key))
}
