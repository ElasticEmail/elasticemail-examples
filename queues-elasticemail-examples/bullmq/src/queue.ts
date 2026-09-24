import "dotenv/config";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { EmailMessage, SendResult } from "./email.js";

export const QUEUE_NAME = "email";

/**
 * BullMQ needs an ioredis instance in native ESM. Workers hold blocking
 * connections, which require maxRetriesPerRequest: null.
 */
export function createConnection(): Redis {
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });
}

// BullMQ does not close a connection you pass in; call queueConnection.quit() when done.
export const queueConnection = createConnection();

export const emailQueue = new Queue<EmailMessage, SendResult>(QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    // 1 try + 4 retries, waiting ~10s, 20s, 40s, 80s (with jitter) between them.
    attempts: 5,
    backoff: { type: "exponential", delay: 10_000, jitter: 0.5 },
    // Keep a bounded history in Redis for inspection.
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
