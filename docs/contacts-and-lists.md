# Contacts and lists

Elastic Email lists are addressed by **name**, not by id. That makes the API pleasant to use and
means a typo creates a second list rather than an error.

## The five operations the examples use

```typescript
// 1. Create the list (400 when it already exists - treat that as success)
await listsApi.listsPost({ ListName: "Newsletter", AllowUnsubscribe: true });

// 2. Add a contact and put it on the list in one call
await contactsApi.contactsPost(
  [{ Email: "ann@example.com", FirstName: "Ann", LastName: "Example", Status: "Active",
     CustomFields: { plan: "Pro" } }],
  ["Newsletter"],
);

// 3. Read it back
const { data } = await contactsApi.contactsByEmailGet("ann@example.com");

// 4. Update
await contactsApi.contactsByEmailPut("ann@example.com", { FirstName: "Anna" });

// 5. Page through the list
const { data: contacts } = await listsApi.listsByListnameContactsGet("Newsletter", 10, 0);
```

The second argument to `contactsPost` is an array of list names. Passing it is what puts the contact
on a list; without it the contact exists account-wide but belongs to nothing.

## Contact status

| Status | Meaning |
|---|---|
| `Active` | Subscribed. Receives campaigns and transactional mail. |
| `Transactional` | Receives transactional mail only, excluded from campaigns. The double opt-in flow parks people here until they confirm. |
| `Unsubscribed` | Opted out. Also lands on the unsubscribe suppression list. |
| `Bounced`, `Complaint` | Set by the system from delivery feedback. |

Creating a contact as `Transactional` is the piece that makes double opt-in honest: you can send the
confirmation email without ever having treated the address as a subscriber. See
[Double opt-in](double-opt-in.md).

## Custom fields

`CustomFields` only stores keys that already exist as custom fields on the account. Unknown keys are
dropped silently - no error, no value. Create the field in the dashboard first, then populate it.

## "Already exists" is not an error

Both `listsPost` and `domainsPost` answer 400 with a message containing "exist" when the thing is
already there. Every example treats that specific case as success:

```typescript
catch (err: any) {
  if (err.response?.status === 400 && /exist/i.test(JSON.stringify(err.response?.data))) {
    // fine, it is already there
  } else {
    throw err;
  }
}
```

The same helper exists in the other languages: `ee_already_exists()` in PHP, `already_exists()` in
Rust, and the equivalent checks in the Python, Ruby, Go, Java and C# examples.

## Adding an existing contact to a list

```typescript
await listsApi.listsByNameContactsPost("Newsletter", { Emails: ["ann@example.com"] });
```

This is how both double opt-in variants complete a subscription: the contact already exists as
`Transactional`, and confirming moves it onto the list.

## Paging

`listsByListnameContactsGet(listName, limit, offset)` takes limit and offset. So do
`contactsGet`, `suppressionsGet`, `webhookGet` and `subaccountsGet`. The examples ask for the first
10 or 50 rows; there is no cursor, so walk the offset for a full export.

## Deleting

```typescript
await contactsApi.contactsByEmailDelete("ann@example.com");
```

Deletion removes the contact and its history. If the goal is "stop emailing this person", a
suppression is the right tool instead - it survives re-import and proves intent later. See
[Suppressions](suppressions.md).

## In this repository

`contacts` in every stack walks all five operations end to end, with the delete commented out so
repeated runs stay harmless. The server apps expose `GET /contacts` and `POST /contacts`; Laravel
additionally exposes `GET`, `PATCH` and `DELETE /api/contacts/{email}`.
