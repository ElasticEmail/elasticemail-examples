# AGENTS.md

Guidance for coding agents working in this repository, or copying examples out of it into another
project. Humans: start with [README.md](README.md).

## What this repository is

Runnable examples for the Elastic Email REST API v4 (`https://api.elasticemail.com/v4`), one folder
per stack, 20 stacks in total. Every stack implements the same use cases with the same route shapes, so
code you learn in one stack maps directly to the others.

- Use case to source file, for every stack: [examples.json](examples.json)
- SDK method name for each use case, in every language: [docs/api-map.md](docs/api-map.md)
- Concepts (webhooks, inbound, double opt-in, deliverability): [docs/](docs/README.md)
- Everything in one file: [llms-full.txt](llms-full.txt)

## Layout

```
<stack>-elasticemail-examples/
  README.md          reference: every example and route for the stack
  QUICKSTART.md      tutorial: five minutes to a delivered email
  .env.example
  typescript/  javascript/     JS-family stacks ship both variants with identical behavior
  examples/                    standalone scripts, one per use case (non-JS stacks and Express/Hono/Bun)
  <framework>_app/             a server app exposing the use cases as HTTP routes
serverless-elasticemail-examples/<platform>/   one small deployable per platform
smtp-elasticemail-examples/<service>/          SMTP relay setup for a platform or framework (docs only)
docs/                          language-neutral guides
scripts/build-agent-files.mjs  regenerates examples.json and llms-full.txt
```

Each stack is self-contained. There is no root package, workspace or shared build.

## Rules that are easy to get wrong

- **Configuration comes from environment variables only.** Never hardcode an API key, sender or
  recipient. Required: `ELASTICEMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_TO`. Full list:
  [docs/environment-variables.md](docs/environment-variables.md).
- **`EMAIL_FROM` must belong to a domain verified on the account.** Most "the send returned 200 but
  nothing arrived" and most 4xx failures on send come from an unverified sender.
- **Webhooks are not signed.** Elastic Email sends each event as a **GET** with the data in the query
  string (`status`, `to`, `transaction`, `messageid`, `category`, `target`). The handler must check a
  shared `?token=` secret with a constant-time compare, and answer 2xx quickly.
- **Saving a webhook fires a test event** (`to=test@test.com`, `messageid=abc1234`). Elastic Email only
  saves the webhook if that request gets a 2xx, so the URL must be publicly reachable at save time.
- **Inbound email is a form POST**, not JSON: `from_email`, `subject`, `body_text`, `body_html`,
  `att1_name`, `att1_content`, ... Protect it with the same `?token=` check.
- **Transactional vs bulk:** `POST /emails/transactional` for one message to personal recipients,
  `POST /emails` for one bulk job with per-recipient merge fields. Both return `TransactionID` and
  `MessageID`.
- **Errors** come back as `{"Error": "message"}` with a 4xx/5xx status. Server examples answer
  `{ "error": "<message>" }` with the same status. See [docs/error-handling.md](docs/error-handling.md).
- **SMTP uses its own credentials.** Host `smtp.elasticemail.com`, port 2525 (or 587/25) with
  STARTTLS, 465 with implicit TLS. Username and password come from Settings > SMTP in the dashboard;
  the password is not the API key. Env vars: `ELASTICEMAIL_SMTP_HOST`, `ELASTICEMAIL_SMTP_PORT`,
  `ELASTICEMAIL_SMTP_USERNAME`, `ELASTICEMAIL_SMTP_PASSWORD`. The SMTP section is
  [smtp-elasticemail-examples/](smtp-elasticemail-examples/README.md); the `From` rule above applies there too.
- **Sub-account creation affects billing.** The sub-accounts example is read-only unless
  `CREATE_SUBACCOUNT=true`. Keep it that way.

## Conventions every stack follows

- Server apps expose the same routes: `POST /send` takes `{ to, subject, message }` and answers
  `{ success, transactionId, messageId }`. Most server apps also expose `GET /health`, which answers
  `{ status: "ok" }`.
- Sends set both an HTML and a plain-text body.
- SDK versions are pinned to the 4.2 line across all stacks. JS/TS stacks use
  `@elasticemail/elasticemail-client-ts-axios`; Elixir has no SDK and calls the REST API with Req.
- SDK method names follow the OpenAPI spec, spelled per language (`emailsTransactionalPost`,
  `emails_transactional_post`, `EmailsTransactionalPostAsync`, ...). Look them up in
  [docs/api-map.md](docs/api-map.md) instead of guessing.

## Checking your change

There are no unit tests: the examples call the live API. Check that the code compiles and that
the stack's own checks pass:

| Stack | Check |
|---|---|
| JS/TS stacks (in `typescript/` or `javascript/`) | `npm install && npm run typecheck` (Astro and SvelteKit: `npm run check`) |
| Serverless platforms | `npm install && npm run typecheck` in the platform folder; Deno/Supabase: `deno check` |
| Python | `pip install -r requirements.txt && python -m py_compile examples/*.py` |
| Ruby | `bundle install && ruby -c examples/*.rb` |
| Go | `go vet ./...` |
| Java | `mvn -q compile` |
| .NET | `dotnet build` |
| Rust | `cargo check --examples` |
| Elixir | `mix compile` |
| PHP / Laravel | `composer install && php -l` on changed files |

To actually send, put real values in `.env` and follow the stack's README. Never commit `.env`.

## Editing docs and READMEs

- Stack `README.md` H1: `<Stack> Email API Examples - Elastic Email`. Stack `QUICKSTART.md` H1:
  `Send your first email with <Stack>`. Serverless platform README H1:
  `Send Email from <Platform> - Elastic Email API`. Nested framework app README H1:
  `<Framework> Email Example - Elastic Email API`. SMTP integration README H1:
  `Send Email from <Service> with SMTP - Elastic Email`.
- Write a lede that is specific to the stack (name the SDK and runtime). Do not copy it from another stack.
- The first Resources bullet links to https://elasticemail.com/email-api.
- SMTP pages link [SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings)
  once, where the reader creates SMTP credentials.
- Link [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain)
  and [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings) once each per page,
  at the step where the reader needs them.
- Send readers who need Elastic Email support to the chat widget on
  [elasticemail.com](https://elasticemail.com), not to the help center.
- Never put prices or sending-volume figures in the repo. Link to https://elasticemail.com/email-api-pricing.
- After adding or renaming an example, run `node scripts/build-agent-files.mjs` and commit the
  regenerated `examples.json` and `llms-full.txt`.

## Adding a stack

See [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-stack).
