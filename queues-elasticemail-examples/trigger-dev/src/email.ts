import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

// A type alias (not an interface) so it also satisfies Record<string, unknown>,
// which job and event payload types expect.
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface SendResult {
  transactionId?: string;
  messageId?: string;
  /** true when an earlier attempt with the same key had already sent it: nothing was sent this time. */
  replayed: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

let emailsApi: EmailsApi | undefined;

/**
 * One transactional send: HTML + plain text, From = EMAIL_FROM.
 *
 * Pass the same idempotencyKey on every attempt of one job. If an earlier attempt
 * reached Elastic Email (say it timed out after the email was accepted), the retry
 * gets that attempt's stored response instead of sending a second copy. The body is
 * built only from the job data and EMAIL_FROM, so every attempt sends the same
 * bytes; a key reused with a different body is rejected with a 422.
 */
export async function sendEmail(message: EmailMessage, idempotencyKey: string): Promise<SendResult> {
  emailsApi ??= new EmailsApi(new Configuration({ apiKey: requireEnv("ELASTICEMAIL_API_KEY") }));

  const { data, headers } = await emailsApi.emailsTransactionalPost(
    {
      Recipients: { To: [message.to] },
      Content: {
        From: requireEnv("EMAIL_FROM"),
        Subject: message.subject,
        Body: [
          { ContentType: "HTML", Content: message.html },
          { ContentType: "PlainText", Content: message.text },
        ],
      },
    },
    idempotencyKey,
  );

  return {
    transactionId: data.TransactionID,
    messageId: data.MessageID,
    replayed: headers["idempotency-replayed"] === "true",
  };
}

export interface ClassifiedError {
  /** true: try again later, with the same idempotency key. false: the same request will fail the same way. */
  retryable: boolean;
  /** HTTP status from the API, or undefined when no response came back. */
  status?: number;
  message: string;
  /** How long the API asked us to wait (its Retry-After header), when it said. */
  retryAfterMs?: number;
}

/** Retry-After is either a number of seconds or an HTTP date. */
function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/**
 * Worth retrying (with the same idempotency key):
 * - no response (timeout, connection reset): the request may or may not have arrived;
 *   the key makes the retry safe either way
 * - 409: an earlier attempt with this key is still being processed
 * - 429 and 5xx, including 503 "key couldn't be checked" (nothing was sent): wait for
 *   Retry-After when the API sends one
 *
 * Permanent: any other 4xx - bad key, unverified sender, invalid payload, suppressed
 * recipient, no credits - will not fix itself. That includes 422 for a key already
 * used with a different request, which is a bug: the body changed between attempts,
 * or two jobs share a key. Errors that did not come from axios at all (a missing env
 * var, a bug) are permanent too.
 */
export function classifyError(err: unknown): ClassifiedError {
  const e = err as {
    isAxiosError?: boolean;
    response?: { status?: number; data?: { Error?: string }; headers?: Record<string, unknown> };
    message?: string;
  };
  const status = e.response?.status;
  const message = e.response?.data?.Error ?? e.message ?? "Unknown error";

  if (!e.isAxiosError) return { retryable: false, message };
  if (status === undefined) return { retryable: true, message };
  if (status === 409 || status === 429 || status >= 500) {
    return { retryable: true, status, message, retryAfterMs: parseRetryAfter(e.response?.headers?.["retry-after"]) };
  }
  return { retryable: false, status, message };
}
