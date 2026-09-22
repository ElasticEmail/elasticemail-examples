import { Configuration, WebhookApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const webhookApi = new WebhookApi(config);

const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
const token = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";

// Elastic Email does not sign webhook requests. The examples append a shared secret
// as a query parameter and the receiving handler checks it.
const webhookUrl = `${publicUrl}/webhook?token=${encodeURIComponent(token)}`;

const fail = (step: string, err: any) => {
  console.error(`Error (${step}):`, err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
};

// 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
//    and answer 2xx (use a tunnel such as ngrok for local development).
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
  });
  webhookId = data.WebhookID;
  console.log("Webhook created:", webhookId, data.URL);
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

// 3. Delete the one we created (comment out to keep it)
if (webhookId) {
  try {
    await webhookApi.webhookByPublicidDelete(webhookId);
    console.log("\nWebhook deleted:", webhookId);
  } catch (err: any) {
    fail("delete webhook", err);
  }
}
