# Send Email from NextAuth with SMTP - Elastic Email

Send Auth.js (NextAuth) magic-link sign-in emails through the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. The Nodemailer provider in Auth.js
v5 takes an SMTP server and a sender. This page shows the configuration for a Next.js App Router
project, plus the NextAuth v4 equivalent.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).
> Sending app email as well? The [Next.js examples](../../nextjs-elasticemail-examples/) cover the REST API from route handlers and server actions.

## Prerequisites

- A Next.js 14+ app with `next-auth@5` (Auth.js) installed
- A database adapter (Prisma, Drizzle, or another). Email sign-in stores verification tokens, so
  Auth.js requires one
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Setup

```bash
npm install next-auth@beta nodemailer
```

```bash
# .env.local
AUTH_SECRET=generate-with-npx-auth-secret
ELASTICEMAIL_SMTP_HOST=smtp.elasticemail.com
ELASTICEMAIL_SMTP_PORT=2525
ELASTICEMAIL_SMTP_USERNAME=you@yourdomain.com
ELASTICEMAIL_SMTP_PASSWORD=your_smtp_password
EMAIL_FROM=Acme <no-reply@yourdomain.com>
```

## Configure (Auth.js v5)

```ts
// auth.ts
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env.ELASTICEMAIL_SMTP_HOST,
        port: Number(process.env.ELASTICEMAIL_SMTP_PORT ?? 2525),
        secure: false, // STARTTLS on 2525/587; true only for 465
        auth: {
          user: process.env.ELASTICEMAIL_SMTP_USERNAME,
          pass: process.env.ELASTICEMAIL_SMTP_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
});
```

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

Pass `server` as an object, not a connection string. The SMTP username is usually an email
address, and inside a `smtp://user:pass@host` URL the `@` must be encoded as `%40`. Forgetting that
is the most common reason this provider fails to authenticate.

## Configure (NextAuth v4)

```ts
// pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";

export default NextAuth({
  adapter: /* your adapter */,
  providers: [
    EmailProvider({
      server: {
        host: process.env.ELASTICEMAIL_SMTP_HOST,
        port: Number(process.env.ELASTICEMAIL_SMTP_PORT ?? 2525),
        auth: { user: process.env.ELASTICEMAIL_SMTP_USERNAME, pass: process.env.ELASTICEMAIL_SMTP_PASSWORD },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
});
```

## Test it

```tsx
// app/signin/page.tsx
import { signIn } from "@/auth";

export default function SignIn() {
  return (
    <form action={async (formData) => { "use server"; await signIn("nodemailer", formData); }}>
      <input type="email" name="email" placeholder="you@yourdomain.com" required />
      <button type="submit">Email me a sign-in link</button>
    </form>
  );
}
```

Submit your address. The link should arrive within seconds, and clicking it signs you in. SMTP
errors appear in the Next.js server log as `[auth][error] EmailSignInError`.

## Notes

- Auth.js sends a plain HTML and text message by default. To brand it, pass
  `sendVerificationRequest` to the provider and build the message yourself with Nodemailer or the
  Elastic Email API.
- The provider runs server-side only. The SMTP password never reaches the browser, as long as the
  variables don't start with `NEXT_PUBLIC_`.
- The provider uses Nodemailer, which needs the Node.js runtime. Don't put the Auth.js route on the
  Edge runtime.

## AI assistant prompt

```
Add magic-link email sign-in to a Next.js App Router app with Auth.js v5 (next-auth@beta) and the
Elastic Email SMTP relay. Use the Nodemailer provider from "next-auth/providers/nodemailer" with
server = { host: "smtp.elasticemail.com", port: 2525, secure: false, auth: { user, pass } } read
from ELASTICEMAIL_SMTP_USERNAME and ELASTICEMAIL_SMTP_PASSWORD, and from = process.env.EMAIL_FROM
(a sender on a domain verified in Elastic Email). Pass server as an object, not a URL, because the
username is an email address. Configure a database adapter, since email sign-in requires one. Export
handlers from auth.ts and GET/POST from app/api/auth/[...nextauth]/route.ts. Keep the route on the
Node.js runtime.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Auth.js: Nodemailer provider](https://authjs.dev/getting-started/authentication/email)
- [Auth.js: Database adapters](https://authjs.dev/getting-started/database)
- [All SMTP integrations](../README.md)

## License

MIT
