"""
Contacts and Lists Example

Elastic Email lists are addressed by name, not by id.

Usage: python examples/contacts.py
"""

import os
import re
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import LIST_NAME, TO, get_configuration, print_api_error


def fail(step, e):
    print_api_error(step, e)
    sys.exit(1)


def main():
    configuration = get_configuration()
    email = TO

    with ElasticEmail.ApiClient(configuration) as api_client:
        contacts_api = ElasticEmail.ContactsApi(api_client)
        lists_api = ElasticEmail.ListsApi(api_client)

        # 1. Create a list
        try:
            lists_api.lists_post(ElasticEmail.ListPayload(ListName=LIST_NAME, AllowUnsubscribe=True))
            print('List "{}" created.'.format(LIST_NAME))
        except ElasticEmail.ApiException as e:
            if e.status == 400 and re.search("exist", str(e.body), re.IGNORECASE):
                print('List "{}" already exists.'.format(LIST_NAME))
            else:
                fail("create list", e)

        # 2. Add a contact and put it on the list in one call
        try:
            contacts = contacts_api.contacts_post(
                [
                    ElasticEmail.ContactPayload(
                        Email=email,
                        FirstName="Ann",
                        LastName="Example",
                        Status="Active",
                        CustomFields={"plan": "Pro"},  # only existing custom fields are saved
                    )
                ],
                listnames=[LIST_NAME],
            )
            if contacts:
                print("Contact added:", contacts[0].email, "status:", contacts[0].status)
        except ElasticEmail.ApiException as e:
            fail("add contact", e)

        # 3. Read it back
        try:
            contact = contacts_api.contacts_by_email_get(email)
            print(
                "Contact:",
                {
                    "Email": contact.email,
                    "FirstName": contact.first_name,
                    "Status": contact.status,
                    "Source": contact.source,
                },
            )
        except ElasticEmail.ApiException as e:
            fail("get contact", e)

        # 4. Update
        try:
            contact = contacts_api.contacts_by_email_put(
                email, ElasticEmail.ContactUpdatePayload(FirstName="Anna")
            )
            print("Contact updated. FirstName:", contact.first_name)
        except ElasticEmail.ApiException as e:
            fail("update contact", e)

        # 5. List contacts on the list
        try:
            contacts = lists_api.lists_by_listname_contacts_get(LIST_NAME, limit=10, offset=0)
            print('Contacts in "{}" (first {}):'.format(LIST_NAME, len(contacts)))
            for c in contacts:
                print(" -", c.email, c.status)
        except ElasticEmail.ApiException as e:
            fail("list contacts", e)

        # 6. Delete the contact (uncomment to clean up)
        # contacts_api.contacts_by_email_delete(email)
        # print("Contact deleted.")

    print("\nDone.")


if __name__ == "__main__":
    main()
