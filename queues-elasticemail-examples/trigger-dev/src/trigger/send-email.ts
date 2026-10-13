import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk";
import { classifyError, sendEmail, type EmailMessage } from "../email.js";

class RetryableSendError extends Error {
  constructor(message: string, readonly retryAfterMs?: number) {
    super(message);
  }
}

export const sendEmailTask = task({
  id: "send-email",
  // 1 try + 4 retries, waiting ~10s, 20s, 40s, 80s (randomized) between them.
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 120_000,
    randomize: true,
  },
  // Caps how many sends run at once.
  queue: { concurrencyLimit: 5 },
  run: async (payload: EmailMessage, { ctx }) => {
    // One Idempotency-Key per run, the same on every attempt: a retry after a timeout
    // gets the stored response instead of sending a second copy. ctx.run.id is shared
    // by all attempts of this run (ctx.attempt is not), and the trigger-level
    // idempotencyKey in enqueue.ts makes sure one recipient gets one run.
    const idempotencyKey = `send-email-${ctx.run.id}`;
    try {
      const result = await sendEmail(payload, idempotencyKey);
      logger.info("Email sent", { to: payload.to, ...result });
      return result;
    } catch (err) {
      const { retryable, status, message, retryAfterMs } = classifyError(err);
      const label = `${status ?? "network"}: ${message}`;

      if (!retryable) {
        // Fails the run now, whatever attempts are left.
        throw new AbortTaskRunError(`Permanent failure (${label})`);
      }
      // Trigger.dev retries after the backoff delay (or Retry-After, see catchError).
      throw new RetryableSendError(`Retryable failure (${label})`, retryAfterMs);
    }
  },
  // When the API sent Retry-After, wait at least that long before the next attempt.
  catchError: async ({ error, retryDelayInMs }) => {
    if (error instanceof RetryableSendError && error.retryAfterMs !== undefined) {
      return { retryDelayInMs: Math.max(error.retryAfterMs, retryDelayInMs ?? 0) };
    }
  },
});
