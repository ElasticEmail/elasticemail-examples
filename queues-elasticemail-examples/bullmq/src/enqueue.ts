import "dotenv/config";
import { emailQueue, queueConnection } from "./queue.js";

const to = process.env.EMAIL_TO;
if (!to) {
  console.error("EMAIL_TO is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

if (process.argv.includes("--fanout")) {
  // Fan-out: one job per recipient, so one bad address fails alone and the
  // rest still go out. A stable jobId (campaign + user id) makes this script
  // safe to re-run: BullMQ ignores an add whose jobId already exists.
  // All three go to EMAIL_TO here; in your app, load them from your database.
  const campaign = "welcome-2026-09";
  const recipients = [
    { id: "user-1", email: to, name: "Ann" },
    { id: "user-2", email: to, name: "Ben" },
    { id: "user-3", email: to, name: "Cleo" },
  ];

  const jobs = await emailQueue.addBulk(
    recipients.map((r) => ({
      name: "send",
      data: {
        to: r.email,
        subject: `Welcome, ${r.name}`,
        html: `<h1>Hi ${r.name}!</h1><p>Sent from a BullMQ job.</p>`,
        text: `Hi ${r.name}! Sent from a BullMQ job.`,
      },
      opts: { jobId: `${campaign}-${r.id}` },
    })),
  );
  console.log(`Queued ${jobs.length} jobs:`, jobs.map((j) => j.id).join(", "));
} else {
  const job = await emailQueue.add("send", {
    to,
    subject: "Hello from a background job",
    html: "<h1>Hello!</h1><p>This email was sent by a BullMQ worker through Elastic Email.</p>",
    text: "Hello! This email was sent by a BullMQ worker through Elastic Email.",
  });
  console.log(`Queued job ${job.id} for ${to}. Start the worker with: npm run worker`);
}

await emailQueue.close();
await queueConnection.quit();
