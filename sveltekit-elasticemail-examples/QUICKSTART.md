# Send your first email with SvelteKit

Five minutes from a clean clone to a delivered email, using SvelteKit 2 `+server` routes and the
Elastic Email TypeScript SDK.

## Prerequisites

- Node.js 20+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/sveltekit-elasticemail-examples

cp .env.example typescript/.env   # or javascript/.env
cd typescript                     # or javascript
npm install
```

In a project of your own:

```bash
npm install @elasticemail/elasticemail-client-ts-axios
```

## 4. Set your environment variables

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
PUBLIC_URL=http://localhost:5173
```

The examples read them through `$env/dynamic/private`, so values are looked up at runtime rather
than baked into the build. Full list in
[docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

Keep the client in one server-only module, then use it from a `+server.ts` route:

```typescript
// src/lib/server/elasticemail.ts
import { env } from "$env/dynamic/private";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

export const from = env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
export const emailsApi = new EmailsApi(new Configuration({ apiKey: env.ELASTICEMAIL_API_KEY }));
```

```typescript
// src/routes/api/send/+server.ts
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { emailsApi, from } from "$lib/server/elasticemail";

export const POST: RequestHandler = async ({ request }) => {
  const { to, subject, message } = await request.json();

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err: any) {
    return json({ error: err.response?.data?.Error ?? err.message }, { status: err.response?.status ?? 500 });
  }
};
```

Two guardrails do the work here. `$lib/server/` is a directory SvelteKit refuses to import from
client code, and `$env/dynamic/private` is server-only too. Either mistake is a build error
rather than a leaked key.

## 6. Run it

```bash
npm run dev
```

```bash
curl -X POST http://localhost:5173/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from SvelteKit"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## 7. Open the example app

http://localhost:5173 has a page per feature, each calling one of the `+server` routes with `fetch`.

## One SvelteKit-specific setting

Elastic Email posts webhooks form-encoded and without an `Origin` header. SvelteKit's built-in CSRF
check would answer 403 before the handler runs, so `kit.csrf.checkOrigin` is set to `false` in
`svelte.config.js`. Turn it back on if you add form actions that need it, and exempt the webhook
routes instead.

## Next steps

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Build a signup that confirms by email | [Double opt-in](../docs/double-opt-in.md) |
| Every route and file | [README.md](README.md) |
