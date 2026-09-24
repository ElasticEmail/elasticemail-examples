# Send Email from LangChain - Elastic Email API

A LangChain.js tool that lets an agent send transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API. `send_email` is built with `tool()` from `@langchain/core/tools` and a zod schema, calls `emailsTransactionalPost` from `@elasticemail/elasticemail-client-ts-axios`, and runs in a `createAgent` loop (LangChain 1, on LangGraph) with Claude through `ChatAnthropic`.

> Part of the [Elastic Email AI agent examples](../README.md). New to the API? Start with the [AI agent quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20+ · LangChain.js 1 (`langchain@1`, `@langchain/core@1`, `@langchain/anthropic@1`)

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
| `ANTHROPIC_API_KEY` | Your Anthropic API key (read by `ChatAnthropic`) |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-opus-5-5` |

## Run

```bash
npm start
```

The agent is asked to send a short welcome email to `EMAIL_TO`. The script prints every message in the run: the human prompt, the AI message with the tool call, the tool message with `{"transactionId": ..., "messageId": ...}`, and Claude's final answer.

## Use the tool in your own agent

Copy [`src/email-tool.ts`](src/email-tool.ts) into your project. It works anywhere LangChain accepts a tool:

```typescript
import { createAgent } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { sendEmailTool } from "./email-tool.js";

const agent = createAgent({
  model: new ChatAnthropic({ model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5" }),
  tools: [sendEmailTool],
});

await agent.invoke({ messages: [{ role: "user", content: "Email the team that the deploy finished." }] });
```

You can also bind it to a chat model yourself with `model.bindTools([sendEmailTool])` and run your own loop. `createAgent` from `langchain` replaces `createReactAgent` from `@langchain/langgraph/prebuilt`, which is deprecated in LangGraph 1.

The tool takes `{ to, subject, text, html? }`. It always sends both a plain-text and an HTML part; when `html` is omitted it builds simple, HTML-escaped paragraphs from `text`. Model-written HTML is sent as is, except that braces become HTML entities. It returns a JSON string, because LangChain passes the tool's return value to the model as the tool message content: `{"transactionId", "messageId"}` on success or `{"error"}` on failure. Failures from Elastic Email carry the API's own message (for example `Elastic Email API 400: ...`), not a thrown axios error.

## Safety: limit who the agent can email

An agent that reads untrusted text (web pages, tickets, inbound email) can be instructed by that text to email someone else. This is prompt injection, and a system prompt does not reliably stop it. The check lives in the tool instead:

- Only addresses whose domain appears in `EMAIL_ALLOWED_DOMAINS` are sent. Matching is exact: `yourdomain.com` does not allow `mail.yourdomain.com`.
- With `EMAIL_ALLOWED_DOMAINS` unset, only the domain of `EMAIL_TO` is allowed. With neither set, every send is refused.
- A refused send returns `{"error": "Recipient not allowed: ..."}` and never calls the API.
- Model-written content is cleaned before it is sent: line breaks and braces are removed from the subject, braces are removed from the plain-text body, and braces in the HTML body become `&#123;` and `&#125;`. Elastic Email treats `{...}` and `{{...}}` in message content as template syntax, so strip braces from user input.

For production, put a person in the loop before each send. LangChain 1 ships `humanInTheLoopMiddleware`, which pauses the agent before chosen tools run. It needs a checkpointer so the run can be resumed:

```typescript
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { MemorySaver, Command } from "@langchain/langgraph";

const agent = createAgent({
  model,
  tools: [sendEmailTool],
  middleware: [humanInTheLoopMiddleware({ interruptOn: { send_email: { allowedDecisions: ["approve", "reject"] } } })],
  checkpointer: new MemorySaver(),
});

const config = { configurable: { thread_id: "welcome-1" } };
const paused = await agent.invoke({ messages: [{ role: "user", content: prompt }] }, config);
// paused.__interrupt__ holds the pending send_email call. Show it to a person, then:
await agent.invoke(new Command({ resume: { decisions: [{ type: "approve" }] } }), config);
```

Give the agent its own Elastic Email API key with sending access only, so you can revoke it on its own.

## Notes

- `EMAIL_FROM` must be on a domain verified in your Elastic Email account, or the send fails.
- `@langchain/langgraph` is installed as a dependency of `langchain`; add it to `package.json` yourself if you import from it directly, as in the approval snippet.
- `npm run typecheck` checks the project with `tsc`. There are no unit tests; the demo calls live APIs.

## AI assistant prompt

```
Add an email-sending tool to my LangChain.js 1 agent in TypeScript using Elastic Email.
Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x): create
new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY })) and call
emailsTransactionalPost with Recipients.To = [to] and Content = { From: process.env.EMAIL_FROM,
Subject, Body: [{ ContentType: "HTML", Content }, { ContentType: "PlainText", Content }] }.
Define it with tool() from @langchain/core/tools, name "send_email", and a zod schema
{ to: z.email(), subject, text, html optional }. Before sending, refuse any recipient whose domain
is not in the comma-separated env var EMAIL_ALLOWED_DOMAINS (default: the domain of EMAIL_TO).
Return JSON text: { transactionId, messageId } on success, or { error } with
err.response.data.Error on failure; never throw. Run it with createAgent from "langchain" and
new ChatAnthropic({ model: process.env.ANTHROPIC_MODEL }). Strip { and } from subject and text, remove line breaks from the subject, and in the HTML
body escape HTML and turn braces into &#123; and &#125;. Never hardcode keys.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [LangChain.js: tools](https://docs.langchain.com/oss/javascript/langchain/tools)
- [LangChain.js: human-in-the-loop](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop)
- [Elastic Email MCP server](https://elasticemail.com/mcp)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
