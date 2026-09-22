# Suppressions

A suppression stops mail to an address regardless of what your lists say. Elastic Email keeps three
kinds: unsubscribes, bounces and complaints.

```typescript
// Add
await suppressionsApi.suppressionsUnsubscribesPost(["someone@example.com"]);

// Read one
const { data } = await suppressionsApi.suppressionsByEmailGet("someone@example.com");
// data.Email, data.FriendlyErrorMessage, data.DateUpdated

// Page through all of them
const { data: all } = await suppressionsApi.suppressionsGet(10, 0);

// Remove
await suppressionsApi.suppressionsByEmailDelete("someone@example.com");
```

## The three kinds

| Kind | Added by | Remove it? |
|---|---|---|
| Unsubscribe | The recipient clicking the unsubscribe link, or your own call | Only if the person asks to resubscribe. Do it through a fresh opt-in, not silently. |
| Bounce | A hard failure reported by the receiving server | No. The address does not exist. Removing it buys another bounce and a worse sender reputation. |
| Complaint | The recipient pressing "this is spam" | Never. Mailing again after a complaint is what gets domains blocked. |

Suppressions are account-wide and outrank every list. Importing a suppressed address back onto a list
does not make it deliverable.

## Suppression vs deleting the contact

Deleting removes the record. Nothing then stops the address being re-imported next week and mailed
again. A suppression is the durable "do not send" and the record you want when someone asks why they
stopped receiving mail.

## Where they come from automatically

- `Unsubscribed` webhook events, when the list has `AllowUnsubscribe: true`.
- `Error` webhook events with a hard bounce category.
- `AbuseReport` webhook events.

You do not need to mirror these into your own database for sending to work - Elastic Email enforces
them. Mirror them anyway if your product shows an email-preferences screen, so the UI tells the truth.

## In this repository

`suppressions` in every stack adds an address, reads it back, lists the first page and removes it
again, so a run leaves no trace. Pass an address to target a specific one:

```bash
npx tsx examples/suppressions.ts someone@example.com    # Express / Hono / Bun (TypeScript)
python examples/suppressions.py someone@example.com     # Python
go run ./examples/suppressions/ someone@example.com     # Go
dotnet run -- suppressions someone@example.com          # .NET
```
