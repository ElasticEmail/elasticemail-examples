# Troubleshooting

Symptom first, cause second.

## Sending

**401 Unauthorized**
The key is missing, wrong, or not reaching the process. Check for a stale shell that still has the
old value exported, and remember that `.env` is read from the working directory - running
`go run ./examples/basic_send/` from the wrong folder finds no file and loads nothing.

**400 with a message about the sender**
`EMAIL_FROM` is not on a verified domain. Run the domains example to see the state, and read
[Domains and deliverability](domains-and-deliverability.md). If the domain is not verified yet,
[How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain)
has the dashboard steps. The `Name <address>` form is fine; the address inside it is what gets checked.

**402 Payment Required**
Out of credits.

**403 Forbidden**
The API key lacks permission for that operation, or the feature is not on the plan. Email
verification is the usual one - it is a paid add-on.

**The call succeeds but no email arrives**
In order of likelihood: it is in spam; the address is suppressed (`suppressionsByEmailGet` tells you
in one call); you scheduled it with `TimeOffset` and forgot; it bounced. Look up the transaction with
the status call - `Failed` carries the reason.

```bash
npx tsx examples/email-status.ts <transactionId>
```

**Placeholders appear literally, as "Hi {firstname}"**
The merge key does not match. Single braces, exact spelling, and on a bulk send the values go in each
recipient's `Fields`, not in `Merge`.

**The inline image does not render**
`cid:` must match the attachment `Name` exactly, extension included. `cid:logo` will not find
`logo.png`. Verify with `emailsByMsgidViewGet(messageId)`, which returns the rendered body.

**Everything lands in one Gmail thread**
Same subject line. Add a unique `X-Entity-Ref-ID` header per message - see
[Sending email](sending-email.md).

## Webhooks

**Saving the webhook fails**
Elastic Email sends a GET to the URL on save and expects a 2xx. The URL must be publicly reachable at
that moment. `localhost` never is - run a tunnel and set `PUBLIC_URL` to it first.

**Every event answers 401**
The `token` query parameter does not match `ELASTICEMAIL_WEBHOOK_TOKEN`. It is compared byte for byte:
watch for a trailing space or newline in `.env`, and for a value that needed URL-encoding.

**Events arrive but the body is empty**
The payload is form-encoded, not JSON. Mount the urlencoded body parser (`express.urlencoded()` and
its equivalents). The handlers merge query and body precisely because Elastic Email uses GET for some
deliveries and POST for others.

**403 before the handler runs, on SvelteKit**
The framework's CSRF check rejects form posts with no `Origin` header. `kit.csrf.checkOrigin` is set
to `false` in `svelte.config.js` for this reason.

**Duplicate events**
Expected. `NotifyOncePerEmail: false` produces several events per message, and retries can repeat
one. Deduplicate on `messageid` plus `status`.

## Inbound

**Nothing arrives**
Check the MX record first: `dig MX yourdomain.com` must show `mx.inbound.elasticemail.com`. Then check
that the route's `Filter` matches the address, and that `HttpAddress` points at a reachable URL with
the right token.

**The body is truncated, or the request fails on large mail**
Attachments arrive base64-encoded in the form body. Raise the body size limit - Express uses `25mb`
in these examples, and most frameworks default to far less.

## Local development

**`ngrok` URL changes on every restart**
It does, on the free plan. Update `PUBLIC_URL` and recreate the webhook or inbound route, or use a
reserved domain.

**`.env` is ignored**
| Runtime | Gotcha |
|---|---|
| Go | `godotenv.Load()` reads the current working directory. Run from the stack root. |
| Next.js, Astro, Nuxt, Remix, SvelteKit, TanStack | The dev server loads it; the production build reads `process.env` only. For Astro: `node --env-file=.env dist/server/entry.mjs`. |
| .NET | `DotNetEnv.Env.TraversePath()` walks up, so a root `.env` serves `MinimalApiApp` and `MvcApp`. |
| Java Spring Boot | Export the variables; the app does not read `.env` the way the standalone examples do. |
| Elixir | `config/runtime.exs` loads it and stops with a clear message when the key is missing. |
| Serverless | `.env` is for local runs only. Production values go through the platform CLI. |

**Two servers fighting for a port**
The Gin app defaults to 3001 and the ASP.NET MVC app to 3001 so they can run beside their siblings.
Everything else defaults to 3000 and honours `PORT`.

## Serverless runtimes

**`node:http` cannot be resolved, or axios fails at runtime**
Runtimes without Node's http module (Cloudflare Workers, Vercel Edge, Netlify Edge, Deno, Supabase)
need the SDK handed a fetch-based axios instance:

```typescript
const emailsApi = new EmailsApi(config, undefined, axios.create({ adapter: "fetch" }));
```

Keep the top-level `axios` dependency on the same range the SDK uses (`~1.18.0`) so npm dedupes it.

**Cloudflare Workers: env vars are undefined**
They are not globals. They arrive as the second argument of `fetch(request, env)`, so the API client
has to be built per request.

**Supabase: the webhook function returns 401 before your code runs**
JWT verification. Set `verify_jwt = false` for that function, or pass `--no-verify-jwt`.

## Still stuck

Print the full error body - the `Error` field is usually specific. Every stack has a helper for this;
see [Error handling](error-handling.md). Then check the
[REST API reference](https://elasticemail.com/developers/api-documentation/rest-api).
