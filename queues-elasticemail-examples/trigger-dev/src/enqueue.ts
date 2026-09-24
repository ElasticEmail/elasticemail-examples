import "dotenv/config";
import { tasks } from "@trigger.dev/sdk";
// Type-only import: your app gets type checking without bundling the task code.
import type { sendEmailTask } from "./trigger/send-email.js";

const to = process.env.EMAIL_TO;
if (!to) {
  console.error("EMAIL_TO is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// tasks.trigger / tasks.batchTrigger read TRIGGER_SECRET_KEY from the environment.
if (process.argv.includes("--fanout")) {
  // Fan-out: one run per recipient, so one bad address fails alone and the
  // rest still go out. A stable idempotency key (campaign + user id) makes
  // this safe to re-run: Trigger.dev returns the existing run instead of
  // starting a second one. All three go to EMAIL_TO here; in your app, load
  // them from your database.
  const campaign = "welcome-2026-09";
  const recipients = [
    { id: "user-1", email: to, name: "Ann" },
    { id: "user-2", email: to, name: "Ben" },
    { id: "user-3", email: to, name: "Cleo" },
  ];

  const batch = await tasks.batchTrigger<typeof sendEmailTask>(
    "send-email",
    recipients.map((r) => ({
      payload: {
        to: r.email,
        subject: `Welcome, ${r.name}`,
        html: `<h1>Hi ${r.name}!</h1><p>Sent from a Trigger.dev task.</p>`,
        text: `Hi ${r.name}! Sent from a Trigger.dev task.`,
      },
      options: { idempotencyKey: `${campaign}-${r.id}`, idempotencyKeyTTL: "7d" },
    })),
  );
  console.log(`Batch ${batch.batchId} queued with ${batch.runCount} runs`);
} else {
  const handle = await tasks.trigger<typeof sendEmailTask>("send-email", {
    to,
    subject: "Hello from a background job",
    html: "<h1>Hello!</h1><p>This email was sent by a Trigger.dev task through Elastic Email.</p>",
    text: "Hello! This email was sent by a Trigger.dev task through Elastic Email.",
  });
  console.log(`Run ${handle.id} queued for ${to}`);
}
