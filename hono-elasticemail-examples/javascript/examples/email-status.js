import "dotenv/config";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

// Usage: node examples/email-status.js <transactionId> [messageId]
// Both ids are returned by every send call.
const [transactionId, messageId] = process.argv.slice(2);

if (!transactionId) {
  console.error("Usage: node examples/email-status.js <transactionId> [messageId]");
  process.exit(1);
}

try {
  const { data } = await emailsApi.emailsByTransactionidStatusGet(
    transactionId,
    true, // showFailed
    true, // showSent
    true, // showDelivered
    true, // showPending
    true, // showOpened
    true, // showClicked
  );

  console.log("=== Transaction status ===");
  console.log("Status:     ", data.Status);
  console.log("Recipients: ", data.RecipientsCount);
  console.log("Sent:       ", data.SentCount, data.Sent ?? []);
  console.log("Delivered:  ", data.DeliveredCount, data.Delivered ?? []);
  console.log("Pending:    ", data.PendingCount);
  console.log("Opened:     ", data.OpenedCount);
  console.log("Clicked:    ", data.ClickedCount);
  console.log("Failed:     ", data.FailedCount, data.Failed ?? []);
} catch (err) {
  console.error("Error fetching status:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}

if (messageId) {
  try {
    const { data } = await emailsApi.emailsByMsgidViewGet(messageId);
    console.log("\n=== Message ===");
    console.log("From:    ", data.Preview?.From);
    console.log("Subject: ", data.Preview?.Subject);
    console.log("Status:  ", data.Status?.StatusName, data.Status?.DateSent ?? "");
    const body = data.Preview?.Body ?? "";
    console.log("Body preview:", body.length > 200 ? body.slice(0, 200) + "..." : body);
  } catch (err) {
    console.error("Error fetching message:", err.response?.status, err.response?.data ?? err.message);
  }
}
