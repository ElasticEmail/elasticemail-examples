import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk";
import { classifyError, sendEmail, type EmailMessage } from "../email.js";

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
  run: async (payload: EmailMessage) => {
    try {
      const result = await sendEmail(payload);
      logger.info("Email sent", { to: payload.to, ...result });
      return result;
    } catch (err) {
      const { retryable, status, message } = classifyError(err);
      const label = `${status ?? "network"}: ${message}`;

      if (!retryable) {
        // Fails the run now, whatever attempts are left.
        throw new AbortTaskRunError(`Permanent failure (${label})`);
      }
      // A plain throw: Trigger.dev retries after the backoff delay.
      throw new Error(`Retryable failure (${label})`);
    }
  },
});
