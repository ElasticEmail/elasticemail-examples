---
name: elasticemail
description: Add Elastic Email to an existing project - sending transactional or bulk email, templates, attachments, webhook event handling, inbound email, contacts, double opt-in or domain setup - using the official Elastic Email SDK for the project's language. Use when the user asks to send email from their app, integrate Elastic Email, handle email webhooks or bounces, or receive inbound email with Elastic Email.
---

# Elastic Email integration

Copy a working example from https://github.com/ElasticEmail/elasticemail-examples and adapt it,
instead of writing API calls from memory. The examples target REST API v4 with the official SDKs
(4.2 line); older v2 code you may remember uses different endpoints and parameters.

## 1. Find the matching example

1. Detect the project's stack from its manifest (`package.json` dependencies, `composer.json`,
   `requirements.txt`/`pyproject.toml`, `Gemfile`, `go.mod`, `pom.xml`, `*.csproj`, `Cargo.toml`,
   `mix.exs`) and whether it is TypeScript or JavaScript.
2. Fetch the use-case map:
   `https://raw.githubusercontent.com/ElasticEmail/elasticemail-examples/main/examples.json`.
   Pick the stack by `id` (`nextjs`, `laravel`, `python`, `go`, `serverless-cloudflare-workers`, ...)
   and the use case by `id` (`basic-send`, `batch-send`, `attachments`, `cid-attachments`,
   `templates`, `scheduled-send`, `prevent-threading`, `email-status`, `webhooks`, `inbound`,
   `contacts`, `double-optin`, `suppressions`, `domains`, `statistics`, `email-verification`,
   `sub-accounts`).
3. Read the listed files from `https://raw.githubusercontent.com/ElasticEmail/elasticemail-examples/main/<path>`,
   plus the stack's client helper (for example `src/lib/elasticemail.ts`, `examples/ee.py`,
   `internal/ee/ee.go`) and the matching guide under `docs/`.
4. If the stack is not listed, use the closest one in the same language, and
   `docs/api-map.md` for the SDK method names.

## 2. Install and configure

- Install the SDK the stack entry names in `sdk` (for JS/TS: `@elasticemail/elasticemail-client-ts-axios`).
- Add to the project's env files and `.env.example`, never to source code:
  - `ELASTICEMAIL_API_KEY` - created in the Elastic Email dashboard, shown once
  - `EMAIL_FROM` - must be on a domain verified in Elastic Email
  - `ELASTICEMAIL_WEBHOOK_TOKEN` - only if you add webhook or inbound handlers
- Keep the key server-side. In Next.js, Nuxt, SvelteKit, Remix, Astro and similar, call the SDK only
  from server code (route handlers, server actions, `+server` files, `.server.ts` modules).

## 3. Adapt the code

- Match the project's existing structure, error handling and naming. Do not copy the example's demo
  UI pages.
- Transactional (one message) uses `emailsTransactionalPost`; bulk with per-recipient merge fields
  uses `emailsPost`. Keep both an HTML and a plain-text body.
- Webhook handlers: Elastic Email sends **unsigned GET** requests with the event in the query string.
  Verify `?token=` with a constant-time compare, respond 2xx fast, and skip the test event sent on
  save (`to=test@test.com`, `messageid=abc1234`).
- Inbound handlers receive a **form POST** (`from_email`, `subject`, `body_text`, `body_html`,
  `att1_name`, `att1_content`, ...), protected with the same token check.

## 4. Tell the user what they must do outside the code

- Create an API key: https://help.elasticemail.com/en/articles/4799160-api-settings
- Verify the sending domain (SPF, DKIM): https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain
- For webhooks or inbound email, the URL must be publicly reachable when it is saved in Elastic Email
  (use a tunnel such as ngrok during development).

Do not state prices or sending limits; point to https://elasticemail.com/email-api-pricing.
Troubleshooting by symptom: `docs/troubleshooting.md` in the examples repository.
