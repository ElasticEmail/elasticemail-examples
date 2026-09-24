# Environment variables

Every stack reads the same set of variables from a `.env` file next to the project. Copy
`.env.example` to `.env` and fill in the first three; the rest have working defaults.

| Variable | Required | Default | Used by |
|---|---|---|---|
| `ELASTICEMAIL_API_KEY` | yes | - | Every example. Without it the SDK is not configured and the scripts exit early with a message. Create one in [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings). |
| `EMAIL_FROM` | yes | `Acme <hello@yourdomain.com>` | The `From` header on every send. Must belong to a domain verified on the account. |
| `EMAIL_TO` | yes | `you@yourdomain.com` | Test recipient for the standalone scripts. Elastic Email has no sandbox address, so use one of your own inboxes. |
| `CONTACT_EMAIL` | no | falls back to `EMAIL_FROM` | Team inbox. The inbound handler forwards parsed mail here; the contact form example sends its notification here. |
| `ELASTICEMAIL_WEBHOOK_TOKEN` | no | `change_me` | Shared secret appended to webhook and inbound URLs as `?token=`, and the HMAC key for double opt-in confirm links. Change it before exposing anything publicly. |
| `ELASTICEMAIL_LIST_NAME` | no | `Newsletter` | Contact list used by the contacts and double opt-in examples. Created on first run if missing. |
| `ELASTICEMAIL_TEMPLATE_NAME` | no | `welcome-example` | Template used by the template example. Created on first run if missing. |
| `PUBLIC_URL` | no | per stack (see below) | Base URL used to build confirm links and the webhook/inbound URLs that get registered with Elastic Email. Set it to your tunnel URL during local development. |
| `SENDING_DOMAIN` | no | `yourdomain.com` | Domain used by the domains example and as the inbound route filter (`*@SENDING_DOMAIN`). |
| `CONFIRM_REDIRECT_URL` | no | empty | Where to send the browser after a successful double opt-in confirmation. Empty means the endpoint answers with JSON instead. |
| `PORT` | no | `3000` | Port for the server apps that read it. |
| `CREATE_SUBACCOUNT` | no | unset | Set to `true` to let the sub-accounts example actually create one. Creating a sub-account affects billing, so the example is read-only by default. |
| `SUBACCOUNT_EMAIL` | no | generated | Address for the sub-account the example creates when `CREATE_SUBACCOUNT=true`. |

## SMTP variables

Only the [SMTP integrations](../smtp-elasticemail-examples/README.md) read these. Framework guides
map them onto the framework's own names (`MAIL_*` in Laravel, `EMAIL_*` settings in Django).

| Variable | Required | Default | Used by |
|---|---|---|---|
| `ELASTICEMAIL_SMTP_HOST` | no | `smtp.elasticemail.com` | SMTP server. |
| `ELASTICEMAIL_SMTP_PORT` | no | `2525` | `2525`, `587` or `25` with STARTTLS; `465` with implicit TLS. |
| `ELASTICEMAIL_SMTP_USERNAME` | yes, for SMTP | - | Username from Settings > SMTP in the dashboard. Defaults to your login email there. |
| `ELASTICEMAIL_SMTP_PASSWORD` | yes, for SMTP | - | SMTP password generated with the credentials and shown once. Not the API key. See [SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings). |

`EMAIL_FROM` and `EMAIL_TO` mean the same over SMTP as over the API.

## AI agent and background job variables

Only the [AI agent](../ai-agents-elasticemail-examples/README.md) and
[background job](../queues-elasticemail-examples/README.md) examples read these.

| Variable | Required | Default | Used by |
|---|---|---|---|
| `EMAIL_ALLOWED_DOMAINS` | no | the domain of `EMAIL_TO` | AI agent tools. Comma-separated recipient domains the `send_email` tool may send to; anything else is refused, so a prompt-injected agent cannot mail arbitrary addresses. With neither set, every send is refused. |
| `ANTHROPIC_API_KEY` | yes, for those examples | - | Vercel AI SDK and LangChain agents. |
| `ANTHROPIC_MODEL` | no | `claude-opus-5-5` | Claude model for those agents. |
| `OPENAI_API_KEY` | yes, for that example | - | OpenAI Agents SDK agent. |
| `OPENAI_MODEL` | no | the SDK's default | Model for the OpenAI agent. |
| `REDIS_URL` | no | `redis://localhost:6379` | BullMQ queue and worker. |
| `WORKER_CONCURRENCY` | no | `5` | BullMQ worker: jobs processed in parallel. |

Inngest (`INNGEST_DEV`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`) and Trigger.dev
(`TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`) read their own variables; each README explains them.

## Default `PUBLIC_URL` per stack

The default matches the dev server port, so local links work without editing anything.

| Stack | Default | Stack | Default |
|---|---|---|---|
| Next.js, Node.js, Express, NestJS, Fastify, Hono, Bun, Nuxt, TanStack Start | `http://localhost:3000` | Astro | `http://localhost:4321` |
| Remix, SvelteKit | `http://localhost:5173` | RedwoodJS | `http://localhost:8910` |
| Laravel | `http://localhost:8000` | Go, Java, Kotlin, .NET, Rust, Elixir, PHP, Python, Ruby | `http://localhost:3000` |

## Where the file lives

| Stack | Location |
|---|---|
| Node.js, Express, NestJS, Fastify, Hono, Bun, Astro, Nuxt, SvelteKit, Remix, RedwoodJS, TanStack Start | `.env.example` sits in the stack folder; copy it into the `typescript/` or `javascript/` variant you are running |
| Next.js | `.env.example` is inside each variant folder already |
| Python, Ruby, Go, Java, Kotlin, .NET, Rust, Elixir, PHP, Laravel | stack folder root |
| Template, AI agent and queue sections | inside each subproject |
| Serverless | inside each platform folder; production values are set through the platform CLI, not a file |

## Loading behaviour per runtime

| Runtime | How `.env` is read |
|---|---|
| Node scripts (Node.js, Express, NestJS, Fastify, Hono) | `import "dotenv/config"` at the top of each example |
| Bun | loaded automatically, no import needed |
| Next.js, Astro, Nuxt, Remix, SvelteKit, TanStack, RedwoodJS | the framework dev server loads it; production builds read `process.env` only |
| Python | `python-dotenv`, via `examples/ee.py` |
| Ruby | `dotenv`, via `examples/ee.rb` |
| PHP | `vlucas/phpdotenv`, via `src/bootstrap.php` |
| Laravel | Laravel's own `.env` handling, surfaced through `config/elasticemail.php` |
| Go | `godotenv.Load()` in `internal/ee`; the file must be in the working directory |
| Java, Kotlin | `dotenv-java` with `ignoreIfMissing()`, in `Ee.java` / `Ee.kt` |
| .NET | `DotNetEnv` with `TraversePath()`, so subprojects find the root `.env` |
| Rust | `dotenvy::dotenv()` in `src/lib.rs` |
| Elixir | `config/runtime.exs` loads it and stops with a clear message when the key is missing |
| Serverless | platform secrets (`wrangler secret put`, `vercel env add`, `supabase secrets set`, SAM parameters, Netlify env, Railway variables) |

## Notes

- A verified sender is not optional. Sending from an unverified domain returns a 4xx from the API,
  not a bounce later. See [Domains and deliverability](domains-and-deliverability.md), or
  [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain) for the dashboard steps.
- `ELASTICEMAIL_WEBHOOK_TOKEN` does double duty: URL secret and HMAC key. If you rotate it, confirm
  links already in people's inboxes stop validating.
- `PUBLIC_URL` is what gets stored inside Elastic Email when a webhook or inbound route is created.
  Creating a route while it still points at `localhost` registers a URL Elastic Email cannot reach.
