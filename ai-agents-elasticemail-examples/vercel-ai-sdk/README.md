# Send Email from the Vercel AI SDK - Elastic Email API

A `send_email` tool for the Vercel AI SDK that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API. The tool is defined with `tool()` and a zod schema, calls `emailsTransactionalPost` from `@elasticemail/elasticemail-client-ts-axios`, and runs inside `generateText` with a Claude model from `@ai-sdk/anthropic`. Multi-step tool calling is on, so Claude sends the email, reads the result and then answers.

> Part of the [Elastic Email AI agent examples](../README.md). New here? The [AI agent quickstart](../QUICKSTART.md) walks through this project step by step.

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · Vercel AI SDK 7 (`ai@7`, `@ai-sdk/anthropic@4`)

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An Elastic Email API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Value |
|---|---|
| `ELASTICEMAIL_API_KEY` | Your Elastic Email API key |
| `EMAIL_FROM` | A sender on your verified domain, e.g. `Acme <hello@yourdomain.com>` |
| `EMAIL_TO` | Where the demo sends the welcome email |
| `EMAIL_ALLOWED_DOMAINS` | Comma-separated domains the tool may send to. Defaults to the domain of `EMAIL_TO` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-opus-5-5` |

## Run

```bash
npm start
```

The demo asks Claude to "send a short welcome email to `EMAIL_TO`" and prints each tool call, the tool result and Claude's final answer:

```
Tool call: send_email { to: 'you@yourdomain.com', subject: 'Welcome aboard!', text: 'Hi there, ...' }
Tool result: { transactionId: '...', messageId: '...' }

The welcome email is on its way. Transaction ID: ...
```

## Use the tool in your own agent

Copy [`src/email-tool.ts`](src/email-tool.ts) into your project and pass it to `generateText`, `streamText` or a `ToolLoopAgent`:

```typescript
import { generateText, isStepCount } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { sendEmailTool } from "./email-tool.js";

const { text } = await generateText({
  model: anthropic(process.env.ANTHROPIC_MODEL || "claude-opus-5-5"),
  tools: { send_email: sendEmailTool },
  stopWhen: isStepCount(5),
  prompt: "Email the team that the deploy finished.",
});
```

`stopWhen: isStepCount(5)` enables multi-step calls. Without it `generateText` stops after the first step, so the model never sees the tool result. (`stepCountIs` is the older name for the same function and still works.)

The tool takes `{ to, subject, text, html? }`. It always sends both a plain-text and an HTML part; when `html` is omitted it builds simple, HTML-escaped paragraphs from `text`. Model-written HTML is sent as is, except that braces become HTML entities. It returns `{ transactionId, messageId }` on success or `{ error }` on failure. Errors from Elastic Email come back as the API's own message (for example `Elastic Email API 400: ...`) instead of a thrown axios error, so the model can report what went wrong.

## Safety: limit who the agent can email

A model can be talked into things. If the agent reads untrusted text, such as a web page, a support ticket or an inbound email, that text can tell it to mail someone else (prompt injection). The tool therefore checks the recipient itself, outside the model:

- Only addresses whose domain appears in `EMAIL_ALLOWED_DOMAINS` are sent. Matching is exact, so `yourdomain.com` does not allow `mail.yourdomain.com`; list subdomains separately.
- With `EMAIL_ALLOWED_DOMAINS` unset, only the domain of `EMAIL_TO` is allowed. With neither set, every send is refused.
- A refused send returns `{ error: "Recipient not allowed: ..." }` and nothing reaches the API.
- Model-written content is cleaned before it is sent: line breaks and braces are removed from the subject, braces are removed from the plain-text body, and braces in the HTML body become `&#123;` and `&#125;`. Elastic Email treats `{...}` and `{{...}}` in message content as template syntax, so strip braces from user input.

For production, add a human confirmation step before anything is sent. AI SDK 7 has tool approval built into `generateText` and `streamText`: pass `toolApproval: { send_email: "user-approval" }` and the call stops with an approval request instead of running the tool. Show it to a person, then continue the conversation with their approval response. You can also pass a function to `toolApproval` to ask only for some inputs, for example recipients outside your own domain.

Give the agent its own Elastic Email API key with only the access it needs (sending), so you can revoke it without touching other integrations.

## Notes

- `EMAIL_FROM` must be on a domain verified in your Elastic Email account, or the send fails.
- The tool reads `EMAIL_ALLOWED_DOMAINS` on every call, so changes to the environment apply without rebuilding the tool.
- `npm run typecheck` checks the project with `tsc`. There are no unit tests; the demo calls live APIs.

## AI assistant prompt

```
Add an email-sending tool to my Vercel AI SDK (ai@7) agent in TypeScript using Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x): create
new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY })) and call
emailsTransactionalPost with Recipients.To = [to] and Content = { From: process.env.EMAIL_FROM,
Subject, Body: [{ ContentType: "HTML", Content }, { ContentType: "PlainText", Content }] }.
Define the tool with tool({ description, inputSchema: z.object({ to: z.email(), subject, text,
html optional }), execute }). Before sending, refuse any recipient whose domain is not in the
comma-separated env var EMAIL_ALLOWED_DOMAINS (default: the domain of EMAIL_TO) and return
{ error: "Recipient not allowed: ..." }. Return { transactionId, messageId } from response.data, or
{ error } with err.response.data.Error on failure; never throw. Use it with generateText, the
@ai-sdk/anthropic provider, model from process.env.ANTHROPIC_MODEL, and stopWhen: isStepCount(5).
Strip { and } from subject and text, remove line breaks from the subject, and in the HTML
body escape HTML and turn braces into &#123; and &#125;. Never hardcode keys.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [AI SDK: tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK: Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [Elastic Email MCP server](https://elasticemail.com/mcp)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
