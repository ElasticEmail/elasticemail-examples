# Send Email from Supabase Edge Functions - Elastic Email API

Three Deno functions built on the [Elastic Email](https://elasticemail.com/email-api) email API: `send` (transactional email), `webhook` (Elastic Email events) and `auth-hook` (a Supabase Auth "Send Email" hook that delivers sign-up, magic link and recovery emails through Elastic Email).

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Deno (Supabase CLI 1.200+) · Supabase Edge Functions

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) 1.200+ and Docker (for local serving)
- A Supabase project
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
cp .env.example .env
supabase login
supabase link --project-ref <your-project-ref>
```

No `npm install`: the functions import `npm:@elasticemail/elasticemail-client-ts-axios@4.2.0` and `npm:axios@1.18.1` directly and Deno fetches them.

## Secrets

```bash
supabase secrets set --env-file .env
# or one at a time
supabase secrets set ELASTICEMAIL_API_KEY=your_api_key EMAIL_FROM="Acme <hello@yourdomain.com>" ELASTICEMAIL_WEBHOOK_TOKEN=change_me
```

## Deploy

```bash
# Local
supabase start
supabase functions serve --env-file .env --no-verify-jwt

# Remote
supabase functions deploy send
supabase functions deploy webhook
supabase functions deploy auth-hook
```

## Test with curl

```bash
# Local: http://localhost:54321/functions/v1
# Remote: https://<project-ref>.supabase.co/functions/v1
URL=http://localhost:54321/functions/v1

curl $URL/send            # GET acts as the health check -> {"status":"ok"}

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Supabase!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

If you keep `verify_jwt = true` for a function, add `-H "Authorization: Bearer <anon key>"`.

### Auth hook

1. Deploy `auth-hook` and copy its URL.
2. In the Supabase dashboard go to Authentication > Hooks > Send Email, choose HTTPS, paste the URL and generate a secret.
3. Store the secret: `supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_..."`.
4. Trigger a sign-up (`supabase.auth.signUp({ email, password })`) and the confirmation email arrives via Elastic Email.

For local development `supabase/config.toml` already enables the hook pointing at the local functions server.

## Notes on runtime quirks

- Deno's npm compatibility layer does not provide a working `node:http` client for axios, so every `EmailsApi` is created with `axios.create({ adapter: "fetch" })` as the third constructor argument.
- Pin versions in `npm:` specifiers (`@4.2.0`, `axios@1.18.1`, the axios range the SDK itself depends on). Unpinned specifiers make cold starts slower and deployments non-reproducible.
- Elastic Email posts webhooks without a JWT. Set `verify_jwt = false` for `webhook` (done in `config.toml`, or pass `--no-verify-jwt` on deploy) and rely on the `?token=` check.
- Functions are single endpoints. `send` answers GET with `{ status: "ok" }` so it doubles as `/health`.
- The auth hook must respond within a few seconds and return `{}` on success or `{ error: { http_code, message } }` on failure; the function does exactly that.
- Logs: `supabase functions logs <name>` or the dashboard.

## AI assistant prompt

```
Write Supabase Edge Functions (Deno, Deno.serve) in TypeScript that send email with Elastic Email.
Import { Configuration, EmailsApi } from "npm:@elasticemail/elasticemail-client-ts-axios@4.2.0" and
axios from "npm:axios@1.18.1". Read the key with Deno.env.get("ELASTICEMAIL_API_KEY"), set via
`supabase secrets set`; never hardcode keys. Create `new Configuration({ apiKey })` and
`new EmailsApi(configuration, undefined, axios.create({ adapter: "fetch" }))` because Deno has no node:http for axios.
POST /send takes { to, subject, message } and calls emailsApi.emailsTransactionalPost with
Recipients.To = [to] and Content = { From, Subject, Body: [{ ContentType: "HTML", Content }] }.
The From address must be a sender verified in Elastic Email. Return { success, transactionId, messageId }
from response.data, and { error } with the API status on failure (err.response.data.Error).
Add a webhook function that checks ?token= against ELASTICEMAIL_WEBHOOK_TOKEN and logs the status field,
and an auth-hook function for the Supabase Auth Send Email hook that reads { user, email_data } and sends
the verification link built from email_data.token_hash and email_action_type.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Auth Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
