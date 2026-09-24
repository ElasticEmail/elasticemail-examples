# Account: statistics, verification, sub-accounts

## Statistics

Account-wide delivery numbers for a date range.

```typescript
const iso = (d: Date) => d.toISOString().slice(0, 19);   // YYYY-MM-DDThh:mm:ss, no timezone, UTC
const to = new Date();
const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));
```

| Field | Meaning |
|---|---|
| `Recipients` | Addresses targeted |
| `EmailTotal` | Messages submitted |
| `Delivered` | Accepted by the receiving server |
| `Bounced` | Rejected |
| `InProgress` | Still queued, including scheduled sends |
| `Opened`, `Clicked` | Tracked engagement |
| `Unsubscribed`, `Complaints` | Opt-outs and spam reports |

The date format has no timezone suffix and is interpreted as UTC. Sending an offset, or a `Z`, gets
you an error or a surprising window.

Numbers to keep an eye on: bounce rate under about 2%, complaints under 0.1%. Both are computed off
`EmailTotal`, and both are early warnings - see
[Domains and deliverability](domains-and-deliverability.md).

The web apps expose this as `GET /statistics?days=30`.

## Email verification

Checks whether an address is deliverable before you send to it. **This is a paid feature** - accounts
without it get a 4xx.

```typescript
await verificationsApi.verificationsByEmailPost(email);        // start
const { data } = await verificationsApi.verificationsByEmailGet(email);  // read result
```

| Field | Meaning |
|---|---|
| `Result` | The verdict |
| `Reason` | Why |
| `Disposable` | Throwaway provider |
| `Role` | Role address such as `info@` or `support@` |
| `SuggestedSpelling` | Present on a likely typo, for example `gmial.com` |

Where it earns its cost: at signup, to catch typos before the welcome email bounces, and before
mailing a list that has sat unused for a year. `SuggestedSpelling` is worth surfacing in your signup
form directly.

## Sub-accounts

Separate sending identities under one parent account - each with its own API key, credits and
reputation. Useful for isolating customers in a multi-tenant product, or separating staging from
production.

```typescript
const { data } = await subAccountsApi.subaccountsGet(20, 0);

await subAccountsApi.subaccountsPost({ Email, Password, SendActivation: false });
await subAccountsApi.subaccountsByEmailCreditsPatch(Email, { Credits: 1000, Notes: "Initial allocation" });
const { data: key } = await subAccountsApi.subaccountsByEmailApikeyGet(Email);
```

**Creating a sub-account affects billing.** The example is read-only unless you opt in:

```bash
CREATE_SUBACCOUNT=true npx tsx examples/sub-accounts.ts     # Node.js / Express / Hono / Bun
CREATE_SUBACCOUNT=true python examples/sub_accounts.py      # Python
CREATE_SUBACCOUNT=true dotnet run -- sub-accounts           # .NET
```

Each sub-account is a separate reputation. One tenant's bad list does not sink the others, which is
the main reason to use them at all.

## In this repository

`statistics`, `email-verification` and `sub-accounts` exist in every stack. See the
[API map](api-map.md) for the method names in your language.
