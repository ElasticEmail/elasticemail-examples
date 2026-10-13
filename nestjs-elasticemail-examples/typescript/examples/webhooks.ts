import "dotenv/config";
import { Configuration, WebhookApi, WebhookDeliveryMethod } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const webhookApi = new WebhookApi(config);

const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";

// The webhook is created with signing on and JSON delivery: Elastic Email POSTs each event as a
// JSON body and signs it with HMAC-SHA256 (X-ElasticEmail-Timestamp / X-ElasticEmail-Signature),
// so the URL needs no ?token=. Both options can be set only at creation. The handler verifies the
// signature with ELASTICEMAIL_WEBHOOK_SECRET; without a secret it falls back to ?token= for
// unsigned webhooks.
const webhookUrl = `${publicUrl}/webhook`;

const fail = (step: string, err: any) => {
  console.error(`Error (${step}):`, err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
};

// 1. Create. Elastic Email sends a test event to the URL on save, so the handler must be reachable
//    (use a tunnel such as ngrok for local development). The test event arrives before your
//    server knows the secret; a 401/403 answer to it is accepted, so the create still succeeds.
let webhookId: string | undefined;
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
  // Returned only in this response: store it now, it cannot be read back later.
  console.log("Signing secret (store as ELASTICEMAIL_WEBHOOK_SECRET, shown only once):", data.SigningSecret);
} catch (err: any) {
  fail("create webhook", err);
}

// 2. List
try {
  const { data } = await webhookApi.webhookGet(50, 0);
  console.log(`\nWebhooks (${data.length}):`);
  for (const w of data) {
    console.log(` - ${w.WebhookID} ${w.Name} ${w.URL} enabled=${w.IsEnabled}`);
  }
} catch (err: any) {
  fail("list webhooks", err);
}

// 3. Rotate the signing secret. The old secret stops working immediately (no grace period),
//    so update ELASTICEMAIL_WEBHOOK_SECRET right away.
if (webhookId) {
  try {
    const { data } = await webhookApi.webhookByPublicidSecretRotatePost(webhookId);
    console.log("\nNew signing secret (store as ELASTICEMAIL_WEBHOOK_SECRET):", data.SigningSecret);
  } catch (err: any) {
    fail("rotate secret", err);
  }
}

// 4. Delete the one we created (comment out to keep it)
if (webhookId) {
  try {
    await webhookApi.webhookByPublicidDelete(webhookId);
    console.log("\nWebhook deleted:", webhookId);
  } catch (err: any) {
    fail("delete webhook", err);
  }
}
