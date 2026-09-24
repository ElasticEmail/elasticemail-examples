# Contributing

Thanks for helping improve the Elastic Email examples. Bug reports, fixes to existing examples and new
stacks are all welcome.

## Reporting a problem

[Open an issue](https://github.com/ElasticEmail/elasticemail-examples/issues/new/choose) and pick the
template that fits. For a broken example, include the stack, the example or route, the command you ran
and the full error. Remove your API key and any real recipient addresses first.

Questions about your Elastic Email account, billing or deliverability belong with Elastic Email
support, not here. Reach them through the chat widget on [elasticemail.com](https://elasticemail.com).

## Changing an example

- Keep behavior identical across stacks. If you fix a bug in one stack, check whether the same bug
  exists in the others ([`examples.json`](examples.json) lists the matching files).
- JS-family stacks ship `typescript/` and `javascript/` variants. Change both.
- Configuration comes from environment variables only. Add any new variable to the stack's
  `.env.example` and to [docs/environment-variables.md](docs/environment-variables.md).
- Run the stack's checks before opening a pull request. The commands are in
  [AGENTS.md](AGENTS.md#checking-your-change).
- If you add, rename or remove an example file, run `node scripts/build-agent-files.mjs` and commit
  the regenerated `examples.json`, `llms-full.txt` and README version lines.

## Adding a stack

1. Create `<stack>-elasticemail-examples/` with `README.md`, `QUICKSTART.md` and `.env.example`.
   Use an existing stack in the same language family as the template.
2. Implement the use cases listed in the root [README](README.md#examples-included). Server apps expose the
   shared routes (`POST /send` with `{ to, subject, message }` answering
   `{ success, transactionId, messageId }`) and the webhook and inbound handlers with the `?token=` check.
3. Use the official SDK for the language and pin it to the same version line as the other stacks.
4. Follow the documentation conventions:
   - README H1: `<Stack> Email API Examples - Elastic Email`
   - QUICKSTART H1: `Send your first email with <Stack>`
   - A lede written for this stack that names the SDK and runtime, not copied from another stack
   - https://elasticemail.com/email-api as the first Resources link
   - The domain verification and API settings help articles linked once each, where the reader needs them
   - No prices or sending-volume figures; link to https://elasticemail.com/email-api-pricing
5. Add the stack to the All stacks table in the root README, to [llms.txt](llms.txt), and to `STACKS`
   in [scripts/build-agent-files.mjs](scripts/build-agent-files.mjs). Then run the script.

## Pull requests

Keep each pull request focused on one change. Describe what you changed and how you tested it. Say
whether you sent a real email or only compiled the code.

By contributing you agree that your work is released under the [MIT License](LICENSE.md).
