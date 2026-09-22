package com.elasticemail.examples;

import com.elasticemail.api.ContactsApi;
import com.elasticemail.api.ListsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.Contact;
import com.elasticemail.model.ContactPayload;
import com.elasticemail.model.ContactStatus;
import com.elasticemail.model.ContactUpdatePayload;
import com.elasticemail.model.ListPayload;

import java.util.List;
import java.util.Map;

public class Contacts {
    public static void main(String[] args) {
        var client = Ee.client();
        ContactsApi contactsApi = new ContactsApi(client);
        ListsApi listsApi = new ListsApi(client);

        String listName = Ee.env("ELASTICEMAIL_LIST_NAME", "Newsletter");
        String email = Ee.to();

        // 1. Create a list (Elastic Email lists are addressed by name, not by id)
        try {
            listsApi.listsPost(new ListPayload().listName(listName).allowUnsubscribe(true));
            System.out.println("List \"" + listName + "\" created.");
        } catch (ApiException e) {
            if (e.getCode() == 400 && Ee.errorBody(e).toLowerCase().contains("exist")) {
                System.out.println("List \"" + listName + "\" already exists.");
            } else {
                fail("create list", e);
            }
        }

        // 2. Add a contact and put it on the list in one call
        try {
            List<Contact> created = contactsApi.contactsPost(
                    List.of(new ContactPayload()
                            .email(email)
                            .firstName("Ann")
                            .lastName("Example")
                            .status(ContactStatus.ACTIVE)
                            .customFields(Map.of("plan", "Pro"))), // only existing custom fields are saved
                    List.of(listName));
            Contact c = created.isEmpty() ? null : created.get(0);
            System.out.println("Contact added: " + (c == null ? email : c.getEmail() + " status: " + c.getStatus()));
        } catch (ApiException e) {
            fail("add contact", e);
        }

        // 3. Read it back
        try {
            Contact c = contactsApi.contactsByEmailGet(email);
            System.out.println("Contact: Email=" + c.getEmail() + " FirstName=" + c.getFirstName()
                    + " Status=" + c.getStatus() + " Source=" + c.getSource());
        } catch (ApiException e) {
            fail("get contact", e);
        }

        // 4. Update
        try {
            Contact c = contactsApi.contactsByEmailPut(email, new ContactUpdatePayload().firstName("Anna"));
            System.out.println("Contact updated. FirstName: " + c.getFirstName());
        } catch (ApiException e) {
            fail("update contact", e);
        }

        // 5. List contacts on the list
        try {
            List<Contact> contacts = listsApi.listsByListnameContactsGet(listName, 10, 0);
            System.out.println("Contacts in \"" + listName + "\" (first " + contacts.size() + "):");
            for (Contact c : contacts) {
                System.out.println(" - " + c.getEmail() + " " + c.getStatus());
            }
        } catch (ApiException e) {
            fail("list contacts", e);
        }

        // 6. Delete the contact (uncomment to clean up)
        // contactsApi.contactsByEmailDelete(email);
        // System.out.println("Contact deleted.");

        System.out.println("\nDone.");
    }

    private static void fail(String step, ApiException e) {
        Ee.printApiError(step, e);
        System.exit(1);
    }
}
