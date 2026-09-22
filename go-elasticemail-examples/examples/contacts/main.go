package main

import (
	"fmt"
	"net/http"
	"strings"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

func main() {
	client, ctx := ee.NewClient()

	listName := ee.Env("ELASTICEMAIL_LIST_NAME", "Newsletter")
	email := ee.To()

	// 1. Create a list (Elastic Email lists are addressed by name, not by id)
	listPayload := ElasticEmail.NewListPayload(listName)
	listPayload.SetAllowUnsubscribe(true)

	_, resp, err := client.ListsAPI.ListsPost(ctx).ListPayload(*listPayload).Execute()
	if err != nil {
		if ee.StatusCode(resp) == http.StatusBadRequest && strings.Contains(strings.ToLower(ee.ErrorBody(err)), "exist") {
			fmt.Printf("List %q already exists.\n", listName)
		} else {
			ee.Fail("create list", resp, err)
		}
	} else {
		fmt.Printf("List %q created.\n", listName)
	}

	// 2. Add a contact and put it on the list in one call
	contact := ElasticEmail.NewContactPayload(email)
	contact.SetFirstName("Ann")
	contact.SetLastName("Example")
	contact.SetStatus(ElasticEmail.CONTACTSTATUS_ACTIVE)
	contact.SetCustomFields(map[string]string{"plan": "Pro"}) // only existing custom fields are saved

	added, resp, err := client.ContactsAPI.ContactsPost(ctx).
		ContactPayload([]ElasticEmail.ContactPayload{*contact}).
		Listnames([]string{listName}).
		Execute()
	if err != nil {
		ee.Fail("add contact", resp, err)
	}
	if len(added) > 0 {
		fmt.Println("Contact added:", added[0].GetEmail(), "status:", added[0].GetStatus())
	}

	// 3. Read it back
	got, resp, err := client.ContactsAPI.ContactsByEmailGet(ctx, email).Execute()
	if err != nil {
		ee.Fail("get contact", resp, err)
	}
	fmt.Printf("Contact: email=%s firstName=%s status=%s source=%s\n",
		got.GetEmail(), got.GetFirstName(), got.GetStatus(), got.GetSource())

	// 4. Update
	update := ElasticEmail.NewContactUpdatePayload()
	update.SetFirstName("Anna")

	updated, resp, err := client.ContactsAPI.ContactsByEmailPut(ctx, email).ContactUpdatePayload(*update).Execute()
	if err != nil {
		ee.Fail("update contact", resp, err)
	}
	fmt.Println("Contact updated. FirstName:", updated.GetFirstName())

	// 5. List contacts on the list
	members, resp, err := client.ListsAPI.ListsByListnameContactsGet(ctx, listName).Limit(10).Offset(0).Execute()
	if err != nil {
		ee.Fail("list contacts", resp, err)
	}
	fmt.Printf("Contacts in %q (first %d):\n", listName, len(members))
	for _, c := range members {
		fmt.Printf(" - %s %s\n", c.GetEmail(), c.GetStatus())
	}

	// 6. Delete the contact (uncomment to clean up)
	// if _, err := client.ContactsAPI.ContactsByEmailDelete(ctx, email).Execute(); err == nil {
	// 	fmt.Println("Contact deleted.")
	// }

	fmt.Println("\nDone.")
}
