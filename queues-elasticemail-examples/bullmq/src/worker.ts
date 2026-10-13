import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import { classifyError, sendEmail, type EmailMessage, type SendResult } from "./email.js";
import { QUEUE_NAME, createConnection } from "./queue.js";

const connection = createConnection();

class RetryableSendError extends Error {
  constructor(message: string, readonly retryAfterMs?: number) {
    super(message);
  }
}

/** Exponential backoff with jitter (~10s, 20s, 40s, 80s), but never sooner than the API's Retry-After. */
function backoffStrategy(attemptsMade: number, _type?: string, err?: Error): number {
  const max = 2 ** (attemptsMade - 1) * 10_000;
  const delay = Math.floor(max * (0.5 + Math.random() * 0.5));
  const retryAfter = err instanceof RetryableSendError ? (err.retryAfterMs ?? 0) : 0;
  return Math.max(delay, retryAfter);
}

const worker = new Worker<EmailMessage, SendResult>(
  QUEUE_NAME,
  async (job) => {
    // One Idempotency-Key per job, the same on every attempt: a retry after a timeout
    // gets the stored response instead of sending a second copy. job.id alone is not
    // enough, because auto-generated ids are a counter that starts over if Redis is
    // wiped; job.timestamp (when the job was added) keeps the key unique. Never build
    // the key from job.attemptsMade.
    const idempotencyKey = `email-${job.id}-${job.timestamp}`;
    try {
      return await sendEmail(job.data, idempotencyKey);
    } catch (err) {
      const { retryable, status, message, retryAfterMs } = classifyError(err);
      const label = `${status ?? "network"}: ${message}`;

      if (!retryable) {
        // Moves the job straight to failed, whatever attempts are left.
        throw new UnrecoverableError(`Permanent failure (${label})`);
      }
      // BullMQ retries it after backoffStrategy's delay.
      throw new RetryableSendError(`Retryable failure (${label})`, retryAfterMs);
    }
  },
  {
    connection,
    // How many sends run at once in this process.
    concurrency: Number(process.env.WORKER_CONCURRENCY) || 5,
    settings: { backoffStrategy },
  },
);

worker.on("completed", (job, result) => {
  const replayed = result.replayed ? " (already sent by an earlier attempt)" : "";
  console.log(`[${job.id}] sent to ${job.data.to} - TransactionID ${result.transactionId}, MessageID ${result.messageId}${replayed}`);
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
