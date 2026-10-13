import { NonRetriableError, RetryAfterError } from "inngest";
import { fanoutRequested, inngest, sendRequested } from "./client.js";
import { classifyError, sendEmail } from "./email.js";

/** One email per event. Inngest retries the step with backoff when it throws. */
export const sendEmailFn = inngest.createFunction(
  {
    id: "send-email",
    triggers: [sendRequested],
    // 1 try + 4 retries. Inngest spaces them out with exponential backoff.
    retries: 4,
    // Caps how many sends run at once across all your servers.
    concurrency: { limit: 5 },
  },
  async ({ event, runId, step }) => {
    // One Idempotency-Key per event, the same on every retry: a retry after a timeout
    // gets the stored response instead of sending a second copy. The event id is set
    // once when the event is sent (the fan-out sets it explicitly), so it also holds
    // when you replay the event within 24 hours; runId, which every retry of this run
    // shares, is the fallback. Never build the key from the attempt number.
    const idempotencyKey = `send-email-${event.id ?? runId}`;

    return await step.run("send", async () => {
      try {
        return await sendEmail(event.data, idempotencyKey);
      } catch (err) {
        const { retryable, status, message, retryAfterMs } = classifyError(err);
        const label = `${status ?? "network"}: ${message}`;

        if (!retryable) {
          // Fails the run now, whatever retries are left. Do not pass the axios
          // error as `cause`: its config carries the API key header.
          throw new NonRetriableError(`Permanent failure (${label})`);
        }
        if (retryAfterMs !== undefined) {
          // The API said when to come back (Retry-After): retry the step then.
          throw new RetryAfterError(`Retryable failure (${label})`, retryAfterMs);
        }
        // A plain throw: Inngest retries the step after a backoff.
        throw new Error(`Retryable failure (${label})`);
      }
    });
  },
);

/**
 * Fan-out: turn one "send to these people" event into one send event per
 * recipient, so one bad address fails alone and the rest still go out.
 * The event id makes it idempotent: Inngest drops a second event with the same
 * id, so replaying the fan-out does not send twice.
 */
export const fanoutFn = inngest.createFunction(
  { id: "email-fanout", triggers: [fanoutRequested] },
  async ({ event, step }) => {
    const { campaign, recipients } = event.data;

    await step.sendEvent(
      "fan-out",
      recipients.map((r) =>
        sendRequested.create(
          {
            to: r.email,
            subject: `Welcome, ${r.name}`,
            html: `<h1>Hi ${r.name}!</h1><p>Sent from an Inngest function.</p>`,
            text: `Hi ${r.name}! Sent from an Inngest function.`,
          },
          { id: `${campaign}-${r.id}` },
        ),
      ),
    );

    return { queued: recipients.length };
  },
);

export const functions = [sendEmailFn, fanoutFn];
