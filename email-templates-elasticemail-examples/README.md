# Email Template Examples - Elastic Email

Build the email HTML in your own code with React Email or MJML, then send it through the
[Elastic Email](https://elasticemail.com/email-api) email API with the TypeScript SDK
`@elasticemail/elasticemail-client-ts-axios` on Node.js. Both examples render a welcome email to an
HTML part and a plain-text part and send them in one `emailsTransactionalPost` call. The template
lives in your repository, so it goes through code review and, with React Email, type checking.

> **First time here?** The [email templates quickstart](QUICKSTART.md) gets a React Email template
> into your inbox in five minutes.
> Prefer templates stored in your Elastic Email account? See [Templates and merge fields](../docs/templates.md).

## Examples

| Folder | Library | Template | Renders with | Plain text from |
|---|---|---|---|---|
| [react-email](react-email/) | React Email 6, React 19 | `emails/Welcome.tsx` (typed props) | `render(<Welcome />)` | `render(<Welcome />, { plainText: true })` |
| [mjml](mjml/) | MJML 5 | `emails/welcome.mjml` (`{{name}}` placeholders) | `mjml2html()` + escaped replace | `html-to-text` |

Each folder is a standalone Node.js project with `npm run render` (render only, prints the output,
sends nothing) and `npm run send`. The React Email project also has `npm run dev`, the React Email
preview server.

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Environment variables

Both projects read the same three values from `.env` (copy `.env.example` in the folder):

```
ELASTICEMAIL_API_KEY   API key
EMAIL_FROM             verified sender, e.g. Acme <hello@yourdomain.com>
EMAIL_TO               test recipient
```

## Code templates or hosted templates?

Elastic Email can also store templates in your account and merge `{placeholders}` server-side at
send time. Both approaches end in the same API call; they differ in who edits the template and where
it lives.

| | Code templates (this folder) | Hosted templates ([guide](../docs/templates.md)) |
|---|---|---|
| Where the template lives | Your repository | Your Elastic Email account |
| Who edits it | Developers, through pull requests | Anyone with dashboard access |
| Change the copy without a deploy | No | Yes |
| Code review and history | Git | Dashboard |
| Type-checked data | Yes with React Email (props), no with MJML | No |
| Logic (loops, conditionals, components) | Full language | Merge fields only |
| What the send carries | Full HTML and text | Template name plus `Merge` values |

Pick **React Email** when your team already writes React and wants typed props, shared components
and a live preview. Pick **MJML** when you want a small, framework-free markup language that
compiles to responsive, client-safe HTML, or when designers hand off `.mjml` files. Pick **hosted
templates** when marketing or support owns the copy and needs to change it without a deploy.

### Both: upload the rendered HTML as a hosted template

You can keep the source in git and still send by template name. Render once with Elastic Email
merge fields (single braces) as the values, then store the result with `templatesPost`:

```tsx
import { Configuration, TemplatesApi } from "@elasticemail/elasticemail-client-ts-axios";
import { render } from "react-email";
import Welcome from "./emails/Welcome.js";

const templatesApi = new TemplatesApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));
const email = <Welcome name="{firstname}" actionUrl="{actionurl}" />;

await templatesApi.templatesPost({
  Name: "welcome-react-email",
  Subject: "Welcome to Acme, {firstname}!",
  Body: [
    { ContentType: "HTML", Content: await render(email) },
    { ContentType: "PlainText", Content: await render(email, { plainText: true }) },
  ],
  TemplateScope: "Personal",
});
```

Send it with `TemplateName: "welcome-react-email"` and `Merge: { firstname: "Ann", actionurl: "..." }`,
as shown in [Templates and merge fields](../docs/templates.md). Run the upload from CI to keep the
hosted copy in step with the repository. To replace an existing template, call `templatesByNamePut`
with the same name instead of `templatesPost`.

## AI assistant prompt

```
Write a Node.js TypeScript script that renders an email with React Email and sends it with Elastic Email.
Use the npm packages react-email (version 6, it exports the components and render) and
@elasticemail/elasticemail-client-ts-axios (version 4.x). Put the template in emails/Welcome.tsx as a
component with typed props { name, actionUrl } built from Html, Head, Preview, Body, Container,
Heading, Text and Button. In src/send.tsx, import "dotenv/config", read ELASTICEMAIL_API_KEY,
EMAIL_FROM and EMAIL_TO from process.env and never hardcode them. Render the element twice with
await render(el) and await render(el, { plainText: true }), then call
new EmailsApi(new Configuration({ apiKey })).emailsTransactionalPost with Recipients.To = [to] and
Content = { From, Subject, Body: [{ ContentType: "HTML", Content: html }, { ContentType: "PlainText", Content: text }] }.
The From address must be a sender verified in Elastic Email. Print data.TransactionID and
data.MessageID; on error print err.response?.status and err.response?.data?.Error and exit 1.
Add package.json scripts: send (tsx src/send.tsx), dev (email dev --dir emails, needs @react-email/ui
as a dev dependency) and typecheck (tsc --noEmit).
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Templates and merge fields](../docs/templates.md) - hosted templates in this repository
- [React Email](https://react.email/docs)
- [MJML](https://documentation.mjml.io)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
