# Send your first templated email with React Email

Five minutes from a clean clone to a React Email template in your inbox. You will preview a typed
`<Welcome />` component in the browser, render it to HTML and plain text with React Email 6, and send
both parts with the Elastic Email TypeScript SDK on Node.js.

## Prerequisites

- Node.js 20+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

Creating and managing keys is covered in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. Every email has
to come from an address on a verified domain - there is no shared sandbox sender.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/email-templates-elasticemail-examples/react-email

npm install
cp .env.example .env
```

In a project of your own:

```bash
npm install react-email react react-dom @elasticemail/elasticemail-client-ts-axios dotenv
npm install -D @react-email/ui tsx typescript @types/react
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

`EMAIL_FROM` must be on the domain you verified in step 2.

## 5. Preview the template

```bash
npm run dev
```

Open http://localhost:3000 and pick **Welcome**. The preview uses `Welcome.PreviewProps` and reloads
when you edit `emails/Welcome.tsx`. Stop it with Ctrl+C.

## 6. Send it

This is the heart of `src/send.tsx`:

```tsx
import "dotenv/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";
import { render } from "react-email";
import Welcome from "../emails/Welcome.js";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));
const email = <Welcome name="Ann" actionUrl="https://example.com/start" />;

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: [process.env.EMAIL_TO!] },
  Content: {
    From: process.env.EMAIL_FROM!,
    Subject: "Welcome to Acme, Ann!",
    Body: [
      { ContentType: "HTML", Content: await render(email) },
      { ContentType: "PlainText", Content: await render(email, { plainText: true }) },
    ],
  },
});

console.log("Transaction ID:", data.TransactionID);
```

Check the render first, then send:

```bash
npm run render   # prints the HTML size and the plain-text part, sends nothing
npm run send
```

You should see:

```
Email sent successfully!
Transaction ID: ...
Message ID: ...
```

Check the inbox of `EMAIL_TO`.

## If it did not work

| Output | Fix |
|---|---|
| `Error sending email: 401`, or `400 APIKey Expired` | The key in `.env` is wrong, expired or missing the send permission. |
| A 4xx that mentions the sender or domain | `EMAIL_FROM` is not on a verified domain. Finish step 2. |
| `Transaction ID` printed, but nothing arrived | Check spam, then the activity log in the dashboard. See [Troubleshooting](../docs/troubleshooting.md). |
| `npm run dev` asks to install `@react-email/ui` | Run `npm install` in this folder first; it is a dev dependency. |

## Next steps

Prefer plain markup over React? The [MJML example](mjml/) does the same send from an `.mjml` file
compiled with `mjml2html()`, with escaped `{{placeholders}}` and an `html-to-text` plain-text part:

```bash
cd ../mjml
npm install
cp .env.example .env
npm run send
```

| Do this | Read |
|---|---|
| Choose between code templates and hosted templates | [Section README](README.md#code-templates-or-hosted-templates) |
| Store templates in your account and merge server-side | [Templates and merge fields](../docs/templates.md) |
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Handle API failures properly | [Error handling](../docs/error-handling.md) |
| Every file and script in the React Email example | [react-email/README.md](react-email/README.md) |
