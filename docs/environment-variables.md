# Environment variables

Every stack reads the same set of variables from a `.env` file next to the project. Copy
`.env.example` to `.env` and fill in the first three; the rest have working defaults.

| Variable | Required | Default | Used by |
|---|---|---|---|
| `ELASTICEMAIL_API_KEY` | yes | - | Every example. Without it the SDK is not configured and the scripts exit early with a message. |
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

## Default `PUBLIC_URL` per stack

The default matches the dev server port, so local links work without editing anything.

| Stack | Default | Stack | Default |
|---|---|---|---|
| Next.js, Express, Hono, Bun, Nuxt, TanStack Start | `http://localhost:3000` | Astro | `http://localhost:4321` |
| Remix, SvelteKit | `http://localhost:5173` | RedwoodJS | `http://localhost:8910` |
| Laravel | `http://localhost:8000` | Go, Java, .NET, Rust, Elixir, PHP, Python, Ruby | `http://localhost:3000` |

## Where the file lives

| Stack | Location |
|---|---|
| Express, Hono, Bun, Astro, Nuxt, SvelteKit, Remix, RedwoodJS, TanStack Start | `.env.example` sits in the stack folder; copy it into the `typescript/` or `javascript/` variant you are running |
| Next.js | `.env.example` is inside each variant folder already |
| Python, Ruby, Go, Java, .NET, Rust, Elixir, PHP, Laravel | stack folder root |
| Serverless | inside each platform folder; production values are set through the platform CLI, not a file |

## Loading behaviour per runtime

| Runtime | How `.env` is read |
|---|---|
| Node scripts (Express, Hono) | `import "dotenv/config"` at the top of each example |
| Bun | loaded automatically, no import needed |
| Next.js, Astro, Nuxt, Remix, SvelteKit, TanStack, RedwoodJS | the framework dev server loads it; production builds read `process.env` only |
| Python | `python-dotenv`, via `examples/ee.py` |
| Ruby | `dotenv`, via `examples/ee.rb` |
| PHP | `vlucas/phpdotenv`, via `src/bootstrap.php` |
| Laravel | Laravel's own `.env` handling, surfaced through `config/elasticemail.php` |
| Go | `godotenv.Load()` in `internal/ee`; the file must be in the working directory |
| Java | `dotenv-java` with `ignoreIfMissing()`, in `Ee.java` |
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
