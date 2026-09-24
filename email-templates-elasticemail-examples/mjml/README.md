# Send MJML Email Templates - Elastic Email API

A welcome email written in MJML 5 markup, compiled to responsive HTML with `mjml2html()` on Node.js,
filled with HTML-escaped values, turned into a plain-text part with `html-to-text`, and sent through
the [Elastic Email](https://elasticemail.com/email-api) email API with the TypeScript SDK
`@elasticemail/elasticemail-client-ts-axios`. No framework and no template engine: one `.mjml` file and
a ten-line placeholder function.

> Part of the [Elastic Email email template examples](../README.md). New to the API? Start with the
> [email templates quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · MJML 5

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
| `emails/welcome.mjml` | The template, with `{{name}}` and `{{actionUrl}}` placeholders |
| `src/send.ts` | Compiles the MJML, fills the placeholders, derives plain text, sends with `emailsTransactionalPost` |

## Run

```bash
npm run render      # compile and fill only: prints the HTML size and the plain-text part, sends nothing
npm run send        # compile, fill and send to EMAIL_TO
npm run typecheck   # tsc --noEmit
```

A successful send prints:

```
Email sent successfully!
Transaction ID: ...
Message ID: ...
```

The core of `src/send.ts`:

```typescript
const source = await readFile(new URL("../emails/welcome.mjml", import.meta.url), "utf8");
const { html: compiled, errors } = await mjml2html(source);
if (errors.length > 0) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));

const html = fill(compiled, { name: "Ann", actionUrl: "https://example.com/start" });
const text = convert(html, { wordwrap: 100 });

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

- `mjml2html()` is async in MJML 5 (it was synchronous in MJML 4). Await it.
- With the default `validationLevel: "soft"`, MJML renders invalid markup anyway and lists the
  problems in `errors`. The script treats any entry as fatal and exits with MJML's messages instead of
  sending broken HTML. (`"strict"` throws a `ValidationError` instead of returning `errors`.)
- Placeholders are filled after compiling, so you can compile once at startup and reuse the HTML for
  every send. `fill()` HTML-escapes each value and throws on a placeholder it has no value for,
  instead of sending "Hi {{name}}".
- Escaping keeps a value inside its attribute or text node, but it does not check URLs. Validate
  `actionUrl` if it comes from user input.
- The plain-text part is derived from the final HTML with `html-to-text`, skipping images and the
  hidden `<mj-preview>` text. Links come out as `Get started [https://...]`.
- Need loops or conditionals? Swap `fill()` for Handlebars (`Handlebars.compile(compiled)(values)`),
  which also escapes `{{value}}` by default.
- `{{double}}` braces here are this script's own syntax. Elastic Email hosted templates use
  `{single}` braces - see [Templates and merge fields](../../docs/templates.md) if you want to upload
  the compiled HTML with `templatesPost` and merge server-side instead.
- An error from the API prints the HTTP status and Elastic Email's `Error` message and exits 1. An
  invalid key or an unverified `EMAIL_FROM` is the usual cause; see
  [Error handling](../../docs/error-handling.md).

## AI assistant prompt

```
Write a Node.js TypeScript script that sends an MJML email template with Elastic Email.
Use the npm packages mjml (version 5, mjml2html is async), html-to-text, dotenv and
@elasticemail/elasticemail-client-ts-axios (version 4.x); add @types/mjml, @types/html-to-text and
tsx as dev dependencies. Put the template in emails/welcome.mjml with {{name}} and {{actionUrl}}
placeholders. In src/send.ts, import "dotenv/config" and read ELASTICEMAIL_API_KEY, EMAIL_FROM and
EMAIL_TO from process.env (never hardcode them). Read the file, call
await mjml2html(source) and exit 1 printing formattedMessage for each
entry if errors is non-empty. Replace {{key}} in the compiled HTML with HTML-escaped values and throw
on unknown keys. Build the text part with convert(html) from html-to-text. Send with
new EmailsApi(new Configuration({ apiKey })).emailsTransactionalPost({ Recipients: { To: [to] },
Content: { From, Subject, Body: [{ ContentType: "HTML", Content: html }, { ContentType: "PlainText", Content: text }] } }).
EMAIL_FROM must be on a domain verified in Elastic Email. Print data.TransactionID and data.MessageID;
on error print err.response?.status and err.response?.data?.Error ?? err.message, then exit 1.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [MJML documentation](https://documentation.mjml.io)
- [html-to-text](https://github.com/html-to-text/node-html-to-text)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
