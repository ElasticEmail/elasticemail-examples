import "dotenv/config";
import {
  Configuration,
  WebhookApi,
  WebhookDeliveryMethod,
} from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const webhookApi = new WebhookApi(config);

const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
// EnableSigning makes Elastic Email sign every request with HMAC-SHA256 (X-ElasticEmail-Signature
// header) and DeliveryMethod PostJson sends events as POST with a JSON body. The handler verifies
// the signature with ELASTICEMAIL_WEBHOOK_SECRET, so the URL needs no ?token=. Both options are
// fixed at creation. For an unsigned webhook, leave them out and append
// ?token=<ELASTICEMAIL_WEBHOOK_TOKEN> to the URL instead.
const webhookUrl = `${publicUrl}/webhook`;

const fail = (step, err) => {
  console.error(`Error (${step}):`, err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
};

// 1. Create. Elastic Email sends a test event to the URL on save, so the handler must be reachable
//    (use a tunnel such as ngrok for local development). The test event of a signed webhook arrives
//    before your handler knows the secret; a 401/403 answer to it is accepted.
let webhookId;
try {
  const { data } = await webhookApi.webhookPost({
    Name: "examples-webhook",
    URL: webhookUrl,
    NotifyOncePerEmail: false,
    NotificationForSent: true,
    NotificationForOpened: true,
    NotificationForClicked: true,
    NotificationForUnsubscribed: true,
    NotificationForAbuseReport: true,
    NotificationForError: true,
    EnableSigning: true,
    DeliveryMethod: WebhookDeliveryMethod.PostJson,
  });
  webhookId = data.WebhookID;
  console.log("Webhook created:", webhookId, data.URL);
  // Returned only in this response: store it as ELASTICEMAIL_WEBHOOK_SECRET
  console.log("Signing secret (shown once, set ELASTICEMAIL_WEBHOOK_SECRET to it):", data.SigningSecret);
} catch (err) {
  fail("create webhook", err);
}

// 2. List
try {
  const { data } = await webhookApi.webhookGet(50, 0);
  console.log(`\nWebhooks (${data.length}):`);
  for (const w of data) {
    console.log(` - ${w.WebhookID} ${w.Name} ${w.URL} enabled=${w.IsEnabled}`);
  }
} catch (err) {
  fail("list webhooks", err);
}

// 3. Rotate the signing secret. The old secret stops working immediately (no grace period),
//    so update ELASTICEMAIL_WEBHOOK_SECRET right away.
if (webhookId) {
  try {
    const { data } = await webhookApi.webhookByPublicidSecretRotatePost(webhookId);
    console.log("\nNew signing secret:", data.SigningSecret);
  } catch (err) {
    fail("rotate signing secret", err);
  }
}

// 4. Delete the one we created (comment out to keep it)
if (webhookId) {
  try {
    await webhookApi.webhookByPublicidDelete(webhookId);
    console.log("\nWebhook deleted:", webhookId);
  } catch (err) {
    fail("delete webhook", err);
  }
}
