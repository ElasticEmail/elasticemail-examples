import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import { classifyError, sendEmail, type EmailMessage, type SendResult } from "./email.js";
import { QUEUE_NAME, createConnection } from "./queue.js";

const connection = createConnection();

const worker = new Worker<EmailMessage, SendResult>(
  QUEUE_NAME,
  async (job) => {
    try {
      return await sendEmail(job.data);
    } catch (err) {
      const { retryable, status, message } = classifyError(err);
      const label = `${status ?? "network"}: ${message}`;

      if (!retryable) {
        // Moves the job straight to failed, whatever attempts are left.
        throw new UnrecoverableError(`Permanent failure (${label})`);
      }
      // A plain throw: BullMQ retries it after the backoff delay.
      throw new Error(`Retryable failure (${label})`);
    }
  },
  {
    connection,
    // How many sends run at once in this process.
    concurrency: Number(process.env.WORKER_CONCURRENCY) || 5,
  },
);

worker.on("completed", (job, result) => {
  console.log(`[${job.id}] sent to ${job.data.to} - TransactionID ${result.transactionId}, MessageID ${result.messageId}`);
});

worker.on("failed", (job, err) => {
  if (!job) return;
  const final = err instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
  console.error(
    `[${job.id}] attempt ${job.attemptsMade}/${job.opts.attempts ?? 1} failed - ${err.message}` +
      (final ? " - giving up" : " - will retry"),
  );
});

worker.on("error", (err) => console.error("Worker error:", err.message));

console.log(`Worker listening on queue "${QUEUE_NAME}". Ctrl+C to stop.`);

async function shutdown() {
  // Finishes in-flight jobs before exiting.
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
