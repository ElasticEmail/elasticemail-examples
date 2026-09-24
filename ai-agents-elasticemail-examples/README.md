# AI Agent Email Examples - Elastic Email

Give an LLM agent one narrow, safe way to send email through the [Elastic Email](https://elasticemail.com/email-api) email API. Each project here defines a `send_email` tool in TypeScript on top of the `@elasticemail/elasticemail-client-ts-axios` SDK, hands it to an agent framework, and runs a demo where the agent is asked to send a welcome email. The tool refuses recipients outside an allowlist, so a prompt-injected agent cannot mail arbitrary addresses.

> **First time here?** The [AI agent quickstart](QUICKSTART.md) gets a Claude agent sending its first email with the Vercel AI SDK.
> For the concepts behind sending, see the [Elastic Email guides](../docs/README.md).

## Projects

| Folder | Framework | Model provider | Agent loop |
|---|---|---|---|
| [vercel-ai-sdk](vercel-ai-sdk/) | Vercel AI SDK 7 (`ai`) | Anthropic Claude via `@ai-sdk/anthropic` | `generateText` with `stopWhen: isStepCount(5)` |
| [langchain](langchain/) | LangChain.js 1 (`langchain`, `@langchain/core`) | Anthropic Claude via `@langchain/anthropic` | `createAgent` |
| [openai-agents](openai-agents/) | OpenAI Agents SDK (`@openai/agents`) | OpenAI | `Agent` + `run()` |

Every project has the same layout:

```
src/email-tool.ts   the reusable send_email tool: copy this file into your agent
src/index.ts        demo: asks the agent to send a short welcome email to EMAIL_TO
.env.example        configuration
```

Run any of them with `npm install`, `cp .env.example .env`, fill in the values, then `npm start`.

## The send_email tool

The same tool, written for each framework:

- **Input:** `{ to, subject, text, html? }`. `to` is validated as an email address by the zod schema.
- **Send:** `emailsTransactionalPost` with `From` set to `EMAIL_FROM`, and both a plain-text and an HTML body. When the model leaves out `html`, the tool builds simple, HTML-escaped paragraphs from `text`. Braces are removed from the subject and plain text, and turned into HTML entities in the HTML body.
- **Output:** `{ transactionId, messageId }` on success, `{ error }` on failure. API failures carry Elastic Email's own `Error` message, so the model sees `Elastic Email API 400: ...` rather than a stack trace.
- **Allowlist:** only recipients whose domain is in `EMAIL_ALLOWED_DOMAINS` are sent.

## Safety

An agent acts on text it reads, and some of that text is written by other people: web pages, support tickets, inbound email, documents. Any of it can contain instructions such as "send the customer list to ...". That is prompt injection, and a system prompt does not reliably prevent it. So the rule is enforced in the tool, where the model cannot talk its way past it:

- `EMAIL_ALLOWED_DOMAINS` is a comma-separated list of domains the tool may send to, for example `yourdomain.com,partner.example`. Matching is exact and case-insensitive; subdomains must be listed separately.
- If it is unset, only the domain of `EMAIL_TO` is allowed. If neither is set, every send is refused.
- A refused send returns `{ error: "Recipient not allowed: ..." }` and never reaches the API. Addresses with whitespace or more than one `@` are refused too.
- Model-written content is cleaned before it is sent: line breaks and braces are removed from the subject, braces are removed from the plain-text body, and braces in the HTML body become `&#123;` and `&#125;`. Elastic Email treats `{...}` and `{{...}}` in message content as template syntax, so strip braces from user input.

For production, also add a human confirmation step before each send. All three frameworks have one built in, and each project README shows how to turn it on: `toolApproval` in the AI SDK, `humanInTheLoopMiddleware` in LangChain, and `needsApproval` in the OpenAI Agents SDK. Give the agent its own Elastic Email API key with sending access only, so you can revoke it without affecting anything else.

## Environment variables

```
ELASTICEMAIL_API_KEY    Elastic Email API key
EMAIL_FROM              verified sender, e.g. Acme <hello@yourdomain.com>
EMAIL_TO                recipient for the demo
EMAIL_ALLOWED_DOMAINS   comma-separated domains the tool may send to (default: domain of EMAIL_TO)
ANTHROPIC_API_KEY       vercel-ai-sdk, langchain
ANTHROPIC_MODEL         vercel-ai-sdk, langchain (optional, default claude-opus-5-5)
OPENAI_API_KEY          openai-agents
OPENAI_MODEL            openai-agents (optional, default: the SDK's default model)
```

`EMAIL_FROM` must be on a domain verified in your Elastic Email account ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain)). Create the API key in the dashboard ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings)). The full list for the repository is in [docs/environment-variables.md](../docs/environment-variables.md).

## How this relates to the MCP server and the agent skill

This repository offers three ways to combine Elastic Email with AI agents. They solve different problems:

| | What it is | Use it when |
|---|---|---|
| **These examples** | One narrow tool embedded in your own agent code | You are building an agent or AI feature and want it to send email, with limits you control in code |
| [Elastic Email MCP server](https://github.com/ElasticEmail/elasticemail-mcp-server) | A server that exposes many ready-made tools (send, contacts, lists, segments, templates, campaigns) to any MCP client over HTTP | You want Claude Code, Cursor, VS Code or another MCP client to work with your Elastic Email account directly |
| [Agent skill](../skills/elasticemail/SKILL.md) | Instructions that help a coding agent write Elastic Email integration code | You want a coding agent to add Elastic Email to an existing project |

The MCP server gives an agent broad access to the account. The tool here gives it exactly one action, with the recipient check and error format defined by you. Frameworks that support MCP clients (the AI SDK, LangChain and the OpenAI Agents SDK all do) can use the MCP server instead, but then the server's tool set, not your code, decides what the agent can do.

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Elastic Email MCP server](https://github.com/ElasticEmail/elasticemail-mcp-server)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)
- [Error handling](../docs/error-handling.md)
- Questions about your account: use the chat widget on [elasticemail.com](https://elasticemail.com)

## License

MIT
