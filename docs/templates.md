# Templates and merge fields

Templates are stored in your Elastic Email account and referenced by name at send time. The payload
shrinks to a name plus a bag of values, and the copy can change without a deploy.

## Sending with a template

```typescript
await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    TemplateName: "welcome-example",
    Merge: { firstname: "Ann", company: "Acme" },
  },
});
```

`Merge` values replace `{placeholders}` in both the template's subject and its body. No `Subject` or
`Body` is needed - the template supplies them.

## Creating one from code

The examples create the template on first run so nothing has to be clicked in the dashboard first.
The pattern is get-then-create, because a missing template answers 404:

```typescript
async function ensureTemplate() {
  try {
    await templatesApi.templatesByNameGet(templateName);
  } catch (err: any) {
    if (err.response?.status !== 404) throw err;
    await templatesApi.templatesPost({
      Name: templateName,
      Subject: "Welcome, {firstname}!",
      Body: [
        { ContentType: "HTML", Content: "<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>" },
      ],
      TemplateScope: "Personal",
    });
  }
}
```

| Field | Notes |
|---|---|
| `Name` | The handle you send with. Unique per account. |
| `Subject` | Supports the same `{placeholders}` as the body. |
| `Body` | Same array of parts as an inline send - add a `PlainText` part for the text alternative. |
| `TemplateScope` | `Personal` keeps it to your account; `Global` shares it with sub-accounts. |

Re-running the example is a no-op once the template exists. To change the copy, edit it in the
dashboard or delete it and let the script recreate it.

## Placeholder rules

- Single braces: `{firstname}`, not `{{firstname}}`.
- Unmatched placeholders stay in the message as literal text. That is the usual cause of an email
  reading "Hi {firstname}".
- Merge keys are supplied per send with `Merge`, or per recipient with `Fields` on a bulk send. Both
  feed the same substitution.

## Template vs inline body

| | Template | Inline |
|---|---|---|
| Change copy without deploying | yes | no |
| Non-developers can edit | yes, in the dashboard | no |
| Content lives with the code, reviewable in git | no | yes |
| Payload size | small | grows with the HTML |

A common split: templates for marketing-owned messages, inline HTML for machine-generated ones
(receipts, alerts) where the copy and the code change together.

Laravel takes a third path worth knowing about: Blade views rendered with `view()->render()` and
passed as the HTML body, which keeps the templating in the app while still returning the
`TransactionID` from the API.

## In this repository

`with-template` in every stack: reads `ELASTICEMAIL_TEMPLATE_NAME`, creates the template if it is
missing, then sends with `Merge`. See the [API map](api-map.md) for the method names.
