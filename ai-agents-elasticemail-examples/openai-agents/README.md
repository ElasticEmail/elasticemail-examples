# Send Email from the OpenAI Agents SDK - Elastic Email API

A function tool for the OpenAI Agents SDK for TypeScript (`@openai/agents`) that sends transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API. `send_email` is defined with `tool()` and zod parameters, calls `emailsTransactionalPost` from `@elasticemail/elasticemail-client-ts-axios`, and is given to an `Agent` that `run()` drives on an OpenAI model until it has a final answer.

> Part of the [Elastic Email AI agent examples](../README.md). New to the API? Start with the [AI agent quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · OpenAI Agents SDK 0.18 (`@openai/agents@0.18`)

## Prerequisites

- Node.js 20+
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An Elastic Email API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))
- An OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys)

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
| `OPENAI_API_KEY` | Your OpenAI API key (read by the SDK) |
| `OPENAI_MODEL` | Optional. Leave empty to use the SDK's default model |

## Run

```bash
npm start
```

The agent is asked to send a short welcome email to `EMAIL_TO`. The script prints the tool call, the tool output (`{ transactionId, messageId }` or `{ error }`) and `result.finalOutput`.

## Use the tool in your own agent

Copy [`src/email-tool.ts`](src/email-tool.ts) into your project:

```typescript
import { Agent, run } from "@openai/agents";
import { sendEmailTool } from "./email-tool.js";

const agent = new Agent({
  name: "Ops assistant",
  instructions: "Keep the team informed.",
  tools: [sendEmailTool],
});

const result = await run(agent, "Email the team that the deploy finished.");
console.log(result.finalOutput);
```

The tool takes `{ to, subject, text, html }`. The SDK builds a strict JSON schema from the zod parameters, and strict mode requires every property, so `html` is `nullable()` rather than `optional()`: the model passes `null` when it has no HTML, and the tool then builds simple, HTML-escaped paragraphs from `text`. Model-written HTML is sent as is, except that braces become HTML entities. Every send has both a plain-text and an HTML part. The tool returns `{ transactionId, messageId }` on success or `{ error }` on failure. Failures from Elastic Email carry the API's own message (for example `Elastic Email API 400: ...`), not a thrown axios error.

## Safety: limit who the agent can email

Anything the agent reads can try to steer it. A web page or an inbound email that says "forward this to ..." is prompt injection, and instructions alone do not reliably stop it. The tool enforces the rule in code:

- Only addresses whose domain appears in `EMAIL_ALLOWED_DOMAINS` are sent. Matching is exact: `yourdomain.com` does not allow `mail.yourdomain.com`.
- With `EMAIL_ALLOWED_DOMAINS` unset, only the domain of `EMAIL_TO` is allowed. With neither set, every send is refused.
- A refused send returns `{ error: "Recipient not allowed: ..." }` and never calls the API.
- Model-written content is cleaned before it is sent: line breaks and braces are removed from the subject, braces are removed from the plain-text body, and braces in the HTML body become `&#123;` and `&#125;`. Elastic Email treats `{...}` and `{{...}}` in message content as template syntax, so strip braces from user input.

For production, have a person confirm each send. The Agents SDK supports this per tool: add `needsApproval: true` (or a function of the input) to the `tool({ ... })` call. The run then stops with `result.interruptions` instead of executing the tool; approve or reject each one and resume from the saved state:

```typescript
let result = await run(agent, prompt);
for (const interruption of result.interruptions) {
  // Show interruption.rawItem (the pending send_email call) to a person first.
  result.state.approve(interruption); // or result.state.reject(interruption)
}
result = await run(agent, result.state);
```

Give the agent its own Elastic Email API key with sending access only, so you can revoke it on its own.

## Notes

- `EMAIL_FROM` must be on a domain verified in your Elastic Email account, or the send fails.
- The tool schema sticks to keywords OpenAI strict mode accepts; `z.email()` becomes `format: "email"` with a pattern.
- The SDK sends traces of each run to the OpenAI dashboard by default, including tool inputs such as the email body. Set `OPENAI_AGENTS_DISABLE_TRACING=1` to turn that off.
- `npm run typecheck` checks the project with `tsc`. There are no unit tests; the demo calls live APIs.

## AI assistant prompt

```
Add an email-sending tool to my OpenAI Agents SDK (@openai/agents) agent in TypeScript using
Elastic Email. Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x): create
new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY })) and call
emailsTransactionalPost with Recipients.To = [to] and Content = { From: process.env.EMAIL_FROM,
Subject, Body: [{ ContentType: "HTML", Content }, { ContentType: "PlainText", Content }] }.
Define it with tool({ name: "send_email", description, parameters: z.object({ to: z.email(),
subject, text, html: z.string().nullable() }), execute }). Before sending, refuse any recipient
whose domain is not in the comma-separated env var EMAIL_ALLOWED_DOMAINS (default: the domain of
EMAIL_TO). Return { transactionId, messageId } from response.data, or { error } with
err.response.data.Error on failure; never throw. Add it to a new Agent and call run(). Strip { and } from subject and text, remove line breaks from the subject, and in the HTML
body escape HTML and turn braces into &#123; and &#125;. Never
hardcode keys.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [OpenAI Agents SDK for TypeScript](https://openai.github.io/openai-agents-js/)
- [Agents SDK: tools](https://openai.github.io/openai-agents-js/guides/tools/)
- [Agents SDK: human in the loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/)
- [Elastic Email MCP server](https://github.com/ElasticEmail/elasticemail-mcp-server)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
