# Send your first email with Next.js

Five minutes from a clean clone to a delivered email, using Next.js 15 (App Router) and the Elastic
Email TypeScript SDK.

## Prerequisites

- Node.js 18.18+ (20 or 22 recommended)
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

In the dashboard, add your domain and publish the SPF and DKIM records it shows you. Every email you
send has to come from an address on a verified domain - there is no shared sandbox sender.

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/nextjs-elasticemail-examples/typescript   # or javascript

npm install
cp .env.example .env
```

In a project of your own:

```bash
npm install @elasticemail/elasticemail-client-ts-axios
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

`EMAIL_FROM` must be on the domain you verified in step 2. The remaining variables are documented in
[docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

`src/app/api/send/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

export async function POST(request: Request) {
  const { to, subject, message } = await request.json();

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: process.env.EMAIL_FROM!,
        Subject: subject,
        Body: [
          { ContentType: "HTML", Content: `<p>${message}</p>` },
          { ContentType: "PlainText", Content: message },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      transactionId: data.TransactionID,
      messageId: data.MessageID,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.response?.data?.Error ?? err.message },
      { status: err.response?.status ?? 500 },
    );
  }
}
```

Keep this on the server. An API route, a Server Action or a Route Handler all work; a Client
Component does not, because the key would ship to the browser.

## 6. Run it

```bash
npm run dev
```

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Sent from Next.js"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

Check the inbox. If nothing arrives, the response body carries the reason - see
[docs/troubleshooting.md](../docs/troubleshooting.md).

## 7. Open the example app

http://localhost:3000 has a page per feature, each with a form and a result box: attachments, inline
images, templates, scheduling, contacts, domains, statistics, double opt-in, webhooks and inbound.

## Next steps

| Do this | Read |
|---|---|
| Send to many people at once with per-person values | [Sending email](../docs/sending-email.md) |
| Attach a file or embed an image | [Attachments](../docs/attachments.md) |
| Move the copy into a hosted template | [Templates](../docs/templates.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Build a signup that confirms by email | [Double opt-in](../docs/double-opt-in.md) |
| Every route and file in this example | [README.md](typescript/README.md) |
