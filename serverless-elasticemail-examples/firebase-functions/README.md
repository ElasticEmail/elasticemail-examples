# Send Email from Firebase Cloud Functions - Elastic Email API

Two 2nd gen Cloud Functions for Firebase, written in TypeScript on Node.js 20, that send transactional email through the [Elastic Email](https://elasticemail.com/email-api) email API: an HTTP function `api` with `/health`, `/send` and `/webhook`, and a callable function `sendEmailToMe` that a Flutter, iOS, Android or web app invokes through the Firebase SDK. The API key is a Firebase secret (`defineSecret`) stored in Cloud Secret Manager, which makes this the place a mobile app should send from: the key never ships inside the app.

> Part of the [Elastic Email serverless examples](../README.md). New to the API? Start with the [serverless quickstart](../QUICKSTART.md).

**Versions:** Elastic Email REST API v4 · SDK `@elasticemail/elasticemail-client-ts-axios@4.2.0` · Node.js 20 (firebase-functions 6) · Firebase Cloud Functions

## Prerequisites

- Node.js 20+ and a Firebase project on the Blaze plan (Cloud Functions and Secret Manager require it)
- `npm install -g firebase-tools`
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- An API key from [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api) ([API settings](https://help.elasticemail.com/en/articles/4799160-api-settings))

## Setup

```bash
npm install
cp .env.example .env                    # EMAIL_FROM, loaded by Firebase at deploy
cp .secret.local.example .secret.local  # secrets for the emulator only
firebase login
firebase use --add                      # pick your project; writes .firebaserc
```

`firebase.json` uses this folder as the functions source (`"source": "."`), so there is no nested `functions/` directory.

## Secrets

```bash
firebase functions:secrets:set ELASTICEMAIL_API_KEY
firebase functions:secrets:set ELASTICEMAIL_WEBHOOK_TOKEN
```

Each command prompts for the value and stores it in Cloud Secret Manager. The functions list the secrets they need (`onRequest({ secrets: [apiKey, webhookToken] }, ...)`), and only those functions can read them, through `apiKey.value()`. `EMAIL_FROM` is a plain parameter (`defineString`) read from `.env`.

Keep the secret names out of `.env`: a deploy fails if the same name is both a secret and an environment variable.

## Deploy

```bash
npm run serve    # build + emulator, http://127.0.0.1:5001/demo-elasticemail/us-central1/api
npm run deploy   # firebase deploy --only functions
```

The emulator runs under the `demo-elasticemail` project ID, which needs no login and no real project. Deploy prints the function URLs; the HTTP function is reachable at `https://us-central1-<project>.cloudfunctions.net/api` and at its `run.app` URL.

## Test with curl

```bash
URL=http://127.0.0.1:5001/demo-elasticemail/us-central1/api   # or https://us-central1-<project>.cloudfunctions.net/api

curl $URL/health

curl -X POST $URL/send \
  -H "Content-Type: application/json" \
  -d '{"to": "you@yourdomain.com", "subject": "Hello", "message": "Hi from Firebase!"}'

curl -X POST "$URL/webhook?token=change_me" \
  -d "status=Sent&to=you@yourdomain.com&transaction=abc&messageid=xyz"
```

The callable function is not meant for curl; call it from an app with the Firebase SDK, as shown in the next section. Logs: `firebase functions:log`, or Logs Explorer in the Google Cloud console.

## Call it from a Flutter or mobile app

Never put the Elastic Email API key in a Flutter, React Native, iOS or Android app. Anything shipped in an app binary can be extracted, and the key can send mail as your domain. Send from a backend instead; if your app already uses Firebase, this folder is that backend. The app calls `sendEmailToMe` with the Firebase SDK, and the function checks that the caller is signed in before it touches the key:

```dart
import 'package:cloud_functions/cloud_functions.dart';

final result = await FirebaseFunctions.instance
    .httpsCallable('sendEmailToMe')
    .call({'subject': 'Your receipt', 'message': 'Thanks for your order!'});
print(result.data['transactionId']);
```

The callable sends only to the signed-in user's own verified email address, so a copy of your app cannot be turned into a relay for arbitrary recipients. If your app needs to email other people, decide on the server who may receive what (for example look the recipient up in Firestore), and never take a free-form `to` from the client.

## Notes on runtime quirks

- 2nd gen functions run on Cloud Run with full Node.js 20, so the SDK uses its default axios adapter and `node:crypto` is available for the constant-time token compare.
- The three HTTP routes live in one function; `req.path` is the part of the URL after `/api`. Firebase parses JSON and form-encoded bodies before the handler runs, so `req.body` is already an object.
- `apiKey.value()` works only inside a function that lists the secret in `secrets`, and only at request time, not at module load. That is why the `EmailsApi` is created lazily and cached for warm invocations.
- Changing a secret's value does not update running functions. Redeploy after `functions:secrets:set`.
- HTTP functions are public by default, which the webhook needs: Elastic Email calls it without credentials, and the save-time test event must get a 2xx or the webhook is not saved. The `?token=` check protects it. `/send` is open too, so add your own auth before using it in production, or drop it and keep only the callable.
- Turn on [App Check](https://firebase.google.com/docs/app-check) and set `enforceAppCheck: true` on the callable so only your genuine app can reach it.

## AI assistant prompt

```
Write Cloud Functions for Firebase (2nd gen, firebase-functions v6, Node.js 20, TypeScript) that send email
with Elastic Email. Use the npm package @elasticemail/elasticemail-client-ts-axios (version 4.x).
Declare the API key with defineSecret("ELASTICEMAIL_API_KEY") from firebase-functions/params, set with
`firebase functions:secrets:set`, list it in the function's `secrets` option and read it with .value() at
request time; never hardcode keys. Create `new Configuration({ apiKey })` and `new EmailsApi(configuration)` lazily.
An onRequest function `api` routes on req.path: GET /health returns { status: "ok" }; POST /send takes
{ to, subject, message } and calls emailsApi.emailsTransactionalPost with Recipients.To = [to] and
Content = { From, Subject, Body: [{ ContentType: "HTML", Content }, { ContentType: "PlainText", Content }] }.
The From address must be a sender verified in Elastic Email. Return { success, transactionId, messageId } from
response.data, and { error } with the API status on failure (err.response.data.Error). GET|POST /webhook checks
?token= against a second secret ELASTICEMAIL_WEBHOOK_TOKEN with crypto.timingSafeEqual and logs the status field.
Add an onCall function for a Flutter app that requires request.auth, sends only to request.auth.token.email
when email_verified is true, and throws HttpsError on failure.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions)
- [Configure secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
- [Call functions from your app](https://firebase.google.com/docs/functions/callable) (Flutter, iOS, Android, web)
- [Elastic Email TypeScript SDK](https://github.com/ElasticEmail/elasticemail-ts-axios)
- [Elastic Email API Reference](https://elasticemail.com/developers/api-documentation/rest-api)

## License

MIT
