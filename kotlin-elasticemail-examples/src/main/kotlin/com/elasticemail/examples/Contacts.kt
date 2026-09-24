package com.elasticemail.examples

import com.elasticemail.api.ContactsApi
import com.elasticemail.api.ListsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.ContactPayload
import com.elasticemail.model.ContactStatus
import com.elasticemail.model.ContactUpdatePayload
import com.elasticemail.model.ListPayload

fun main(args: Array<String>) {
    val client = Ee.client()
    val contactsApi = ContactsApi(client)
    val listsApi = ListsApi(client)

    val listName = Ee.env("ELASTICEMAIL_LIST_NAME", "Newsletter")
    val email = Ee.to()

    // 1. Create a list (Elastic Email lists are addressed by name, not by id)
    try {
        listsApi.listsPost(ListPayload().listName(listName).allowUnsubscribe(true))
        println("List \"$listName\" created.")
    } catch (e: ApiException) {
        if (e.code == 400 && Ee.errorBody(e).lowercase().contains("exist")) {
            println("List \"$listName\" already exists.")
        } else {
            Ee.fail("create list", e)
        }
    }

    // 2. Add a contact and put it on the list in one call
    try {
        val created = contactsApi.contactsPost(
            listOf(
                ContactPayload()
                    .email(email)
                    .firstName("Ann")
                    .lastName("Example")
                    .status(ContactStatus.ACTIVE)
                    .customFields(mapOf("plan" to "Pro")), // only existing custom fields are saved
            ),
            listOf(listName),
        )
        val c = created.firstOrNull()
        println("Contact added: ${if (c == null) email else "${c.email} status: ${c.status}"}")
    } catch (e: ApiException) {
        Ee.fail("add contact", e)
    }

    // 3. Read it back
    try {
        val c = contactsApi.contactsByEmailGet(email)
        println("Contact: Email=${c.email} FirstName=${c.firstName} Status=${c.status} Source=${c.source}")
    } catch (e: ApiException) {
        Ee.fail("get contact", e)
    }

    // 4. Update
    try {
        val c = contactsApi.contactsByEmailPut(email, ContactUpdatePayload().firstName("Anna"))
        println("Contact updated. FirstName: ${c.firstName}")
    } catch (e: ApiException) {
        Ee.fail("update contact", e)
    }

    // 5. List contacts on the list
    try {
        val contacts = listsApi.listsByListnameContactsGet(listName, 10, 0)
        println("Contacts in \"$listName\" (first ${contacts.size}):")
        for (c in contacts) {
            println(" - ${c.email} ${c.status}")
        }
    } catch (e: ApiException) {
        Ee.fail("list contacts", e)
    }

    // 6. Delete the contact (uncomment to clean up)
    // contactsApi.contactsByEmailDelete(email)
    // println("Contact deleted.")

    println("\nDone.")
}
