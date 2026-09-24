# Send your first email from an AI agent

Five minutes from a clean clone to an email that a Claude agent wrote and sent. You will run the
[Vercel AI SDK project](vercel-ai-sdk/): a `send_email` tool built on the Elastic Email TypeScript
SDK, given to Claude through `generateText`. Claude decides what to write, calls the tool, reads the
result and reports back.

## Prerequisites

- Node.js 20+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

## 1. Get an Elastic Email API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again. An agent only needs to send, so a key limited to
sending is enough.

Creating and managing keys is covered in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings).

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

Step by step, with the exact DNS records to publish: [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain).

## 3. Install and configure

```bash
cd ai-agents-elasticemail-examples/vercel-ai-sdk
npm install
cp .env.example .env
```

Edit `.env`:

```
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
EMAIL_ALLOWED_DOMAINS=yourdomain.com
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-opus-5-5
```

`EMAIL_ALLOWED_DOMAINS` is the safety net: the tool refuses any recipient outside these domains,
whatever the model asks for. Leave it out and only the domain of `EMAIL_TO` is allowed.

## 4. The tool

This is the core of [`src/email-tool.ts`](vercel-ai-sdk/src/email-tool.ts):

```typescript
export const sendEmailTool = tool({
  description: "Send one transactional email through Elastic Email. ...",
  inputSchema: z.object({
    to: z.email(),
    subject: z.string().min(1),
    text: z.string().min(1),
    html: z.string().optional(),
  }),
  execute: sendEmail, // allowlist check, strip braces, then emailsApi.emailsTransactionalPost(...)
});
```

And [`src/index.ts`](vercel-ai-sdk/src/index.ts) hands it to Claude:

```typescript
const result = await generateText({
  model: anthropic(process.env.ANTHROPIC_MODEL || "claude-opus-5-5"),
  tools: { send_email: sendEmailTool },
  stopWhen: isStepCount(5),
  prompt: `Send a short welcome email to ${process.env.EMAIL_TO} ...`,
});
```

`stopWhen` lets the loop run past the first step, so Claude sees the tool result and can answer.

## 5. Run it

```bash
npm start
```

```
Tool call: send_email { to: 'you@yourdomain.com', subject: 'Welcome aboard!', text: '...' }
Tool result: { transactionId: '...', messageId: '...' }

The welcome email is on its way. Transaction ID: ...
```

Check your inbox. To see the allowlist work, change the prompt in `src/index.ts` to ask for an
address on another domain: the tool returns `Recipient not allowed`, and Claude reports that
instead of sending.

## If it did not arrive

- `Elastic Email API 4xx: ...` in the tool result: the message comes straight from Elastic Email.
  An unverified `EMAIL_FROM` domain or a wrong API key are the usual causes.
- `Recipient not allowed`: add the recipient's domain to `EMAIL_ALLOWED_DOMAINS`.
- An error before any tool call: check `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- More in [troubleshooting](../docs/troubleshooting.md).

## Next steps

- Add a human approval step before each send: see the [Vercel AI SDK README](vercel-ai-sdk/README.md#safety-limit-who-the-agent-can-email).
- The same tool for [LangChain](langchain/) and the [OpenAI Agents SDK](openai-agents/).
- Everything in this section: [AI agent examples](README.md).
