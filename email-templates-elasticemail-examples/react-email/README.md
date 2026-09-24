# Send React Email Templates - Elastic Email API

A welcome email written as a typed React component with React Email 6, rendered to HTML and plain
text with `render()` on Node.js, and sent through the [Elastic Email](https://elasticemail.com/email-api)
email API with the TypeScript SDK `@elasticemail/elasticemail-client-ts-axios`. The `react-email`
package also runs the local preview server, so you can see the template in a browser while you edit it.

> Part of the [Elastic Email email template examples](../README.md). New to the API? Start with the
> [email templates quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · React Email 6 · React 19

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

## Files

| File | What it does |
|---|---|
| `emails/Welcome.tsx` | The template: a component with props `{ name, actionUrl }` and `PreviewProps` for the preview server |
| `src/send.tsx` | Renders `<Welcome />` to HTML and plain text, sends both with `emailsTransactionalPost` |

## Run

```bash
npm run dev         # preview server at http://localhost:3000, reloads as you edit emails/
npm run render      # render only: prints the HTML size and the plain-text part, sends nothing
npm run send        # render and send to EMAIL_TO
npm run typecheck   # tsc --noEmit
```

A successful send prints:

```
Email sent successfully!
Transaction ID: ...
Message ID: ...
```

The core of `src/send.tsx`:

```tsx
const email = <Welcome name="Ann" actionUrl="https://example.com/start" />;

const html = await render(email);
const text = await render(email, { plainText: true });

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Welcome to Acme, Ann!",
    Body: [
      { ContentType: "HTML", Content: html },
      { ContentType: "PlainText", Content: text },
    ],
  },
});
```

## Notes

- React Email 6 ships the components, `render()` and the `email` CLI in one `react-email` package.
  The older `@react-email/components` package is deprecated on npm. The preview server
  additionally needs `@react-email/ui`, which is a dev dependency here.
- `render()` returns a `Promise<string>`, so `await` it. `tsc` catches a missing `await`, because the
  SDK expects a string for `Content`.
- React escapes prop values, so a user-supplied name cannot inject markup. Still validate
  `actionUrl` if it comes from user input: escaping keeps it inside the attribute but does not check
  the URL itself.
- The plain-text render comes from the same component, so the two parts cannot drift apart.
  Buttons and links come out as `Label https://...`.
- Props are checked by `tsc`. Pass the wrong prop name or type and `npm run typecheck` fails before
  anything is sent.
- An error from the API prints the HTTP status and Elastic Email's `Error` message and exits 1. An
  invalid key or an unverified `EMAIL_FROM` is the usual cause; see
  [Error handling](../../docs/error-handling.md).
- To store the rendered output as a hosted template instead, see
  [Both: upload the rendered HTML](../README.md#both-upload-the-rendered-html-as-a-hosted-template).

## AI assistant prompt

```
Add a React Email template to my Node.js TypeScript project and send it with Elastic Email.
Install react-email (version 6; it exports Html, Head, Preview, Body, Container, Heading, Text,
Button and render), react and react-dom 19, @elasticemail/elasticemail-client-ts-axios (version 4.x)
and dotenv; add @react-email/ui and tsx as dev dependencies. Create emails/Welcome.tsx: a default
export component with typed props { name: string; actionUrl: string } and a PreviewProps static.
Create src/send.tsx: import "dotenv/config", read ELASTICEMAIL_API_KEY, EMAIL_FROM and EMAIL_TO from
process.env (never hardcode them), then html = await render(<Welcome ... />) and
text = await render(<Welcome ... />, { plainText: true }). Send with
new EmailsApi(new Configuration({ apiKey })).emailsTransactionalPost({ Recipients: { To: [to] },
Content: { From, Subject, Body: [{ ContentType: "HTML", Content: html }, { ContentType: "PlainText", Content: text }] } }).
EMAIL_FROM must be on a domain verified in Elastic Email. Print data.TransactionID and data.MessageID;
on error print err.response?.status and err.response?.data?.Error ?? err.message, then exit 1.
Set "jsx": "react-jsx" in tsconfig.json. Scripts: dev = "email dev --dir emails", send = "tsx src/send.tsx",
typecheck = "tsc --noEmit".
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [React Email docs](https://react.email/docs)
- [Templates and merge fields](../../docs/templates.md) - hosted templates, the alternative to code templates
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
