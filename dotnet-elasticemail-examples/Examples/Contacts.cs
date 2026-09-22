namespace ElasticEmailExamples;

using ElasticEmail.Api;
using ElasticEmail.Client;
using ElasticEmail.Model;

public static class Contacts
{
    public static async Task RunAsync()
    {
        var config = Ee.Config();
        var contactsApi = new ContactsApi(config);
        var listsApi = new ListsApi(config);

        var listName = Ee.ListName;
        var email = Ee.To;

        // 1. Create a list (Elastic Email lists are addressed by name, not by id)
        try
        {
            await listsApi.ListsPostAsync(new ListPayload(listName: listName, allowUnsubscribe: true));
            Console.WriteLine($"List \"{listName}\" created.");
        }
        catch (ApiException e) when (e.ErrorCode == 400
            && Ee.ErrorMessage(e).Contains("exist", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine($"List \"{listName}\" already exists.");
        }
        catch (ApiException e)
        {
            Ee.Fail("create list", e);
        }

        // 2. Add a contact and put it on the list in one call
        try
        {
            var added = await contactsApi.ContactsPostAsync(
                new List<ContactPayload>
                {
                    new ContactPayload(
                        email: email,
                        firstName: "Ann",
                        lastName: "Example",
                        status: ContactStatus.Active,
                        customFields: new Dictionary<string, string> { ["plan"] = "Pro" }), // only existing custom fields are saved
                },
                new List<string> { listName });
            var first = added.FirstOrDefault();
            Console.WriteLine($"Contact added: {first?.Email} status: {first?.Status}");
        }
        catch (ApiException e)
        {
            Ee.Fail("add contact", e);
        }

        // 3. Read it back
        try
        {
            var contact = await contactsApi.ContactsByEmailGetAsync(email);
            Console.WriteLine($"Contact: Email={contact.Email} FirstName={contact.FirstName} Status={contact.Status} Source={contact.Source}");
        }
        catch (ApiException e)
        {
            Ee.Fail("get contact", e);
        }

        // 4. Update
        try
        {
            var updated = await contactsApi.ContactsByEmailPutAsync(email, new ContactUpdatePayload(firstName: "Anna"));
            Console.WriteLine($"Contact updated. FirstName: {updated.FirstName}");
        }
        catch (ApiException e)
        {
            Ee.Fail("update contact", e);
        }

        // 5. List contacts on the list
        try
        {
            var contacts = await listsApi.ListsByListnameContactsGetAsync(listName, 10, 0);
            Console.WriteLine($"Contacts in \"{listName}\" (first {contacts.Count}):");
            foreach (var c in contacts)
            {
                Console.WriteLine($" - {c.Email} {c.Status}");
            }
        }
        catch (ApiException e)
        {
            Ee.Fail("list contacts", e);
        }

        // 6. Delete the contact (uncomment to clean up)
        // await contactsApi.ContactsByEmailDeleteAsync(email);
        // Console.WriteLine("Contact deleted.");

        Console.WriteLine("\nDone.");
    }
}
