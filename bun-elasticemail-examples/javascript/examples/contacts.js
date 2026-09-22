import { Configuration, ContactsApi, ListsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const contactsApi = new ContactsApi(config);
const listsApi = new ListsApi(config);

const listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
const email = process.env.EMAIL_TO || "you@yourdomain.com";

const fail = (step, err) => {
  console.error(`Error (${step}):`, err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
};

// 1. Create a list (Elastic Email lists are addressed by name, not by id)
try {
  await listsApi.listsPost({ ListName: listName, AllowUnsubscribe: true });
  console.log(`List "${listName}" created.`);
} catch (err) {
  if (err.response?.status === 400 && /exist/i.test(JSON.stringify(err.response?.data))) {
    console.log(`List "${listName}" already exists.`);
  } else {
    fail("create list", err);
  }
}

// 2. Add a contact and put it on the list in one call
try {
  const { data } = await contactsApi.contactsPost(
    [
      {
        Email: email,
        FirstName: "Ann",
        LastName: "Example",
        Status: "Active",
        CustomFields: { plan: "Pro" }, // only existing custom fields are saved
      },
    ],
    [listName],
  );
  console.log("Contact added:", data[0]?.Email, "status:", data[0]?.Status);
} catch (err) {
  fail("add contact", err);
}

// 3. Read it back
try {
  const { data } = await contactsApi.contactsByEmailGet(email);
  console.log("Contact:", { Email: data.Email, FirstName: data.FirstName, Status: data.Status, Source: data.Source });
} catch (err) {
  fail("get contact", err);
}

// 4. Update
try {
  const { data } = await contactsApi.contactsByEmailPut(email, { FirstName: "Anna" });
  console.log("Contact updated. FirstName:", data.FirstName);
} catch (err) {
  fail("update contact", err);
}

// 5. List contacts on the list
try {
  const { data } = await listsApi.listsByListnameContactsGet(listName, 10, 0);
  console.log(`Contacts in "${listName}" (first ${data.length}):`);
  for (const c of data) console.log(" -", c.Email, c.Status);
} catch (err) {
  fail("list contacts", err);
}

// 6. Delete the contact (uncomment to clean up)
// await contactsApi.contactsByEmailDelete(email);
// console.log("Contact deleted.");

console.log("\nDone.");
