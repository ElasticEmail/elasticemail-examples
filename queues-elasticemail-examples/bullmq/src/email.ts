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
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

let emailsApi: EmailsApi | undefined;

/** One transactional send: HTML + plain text, From = EMAIL_FROM. */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  emailsApi ??= new EmailsApi(new Configuration({ apiKey: requireEnv("ELASTICEMAIL_API_KEY") }));

  const { data } = await emailsApi.emailsTransactionalPost({
    Recipients: { To: [message.to] },
    Content: {
      From: requireEnv("EMAIL_FROM"),
      Subject: message.subject,
      Body: [
        { ContentType: "HTML", Content: message.html },
        { ContentType: "PlainText", Content: message.text },
      ],
    },
  });

  return { transactionId: data.TransactionID, messageId: data.MessageID };
}

export interface ClassifiedError {
  /** true: try again later. false: the same request will fail the same way. */
  retryable: boolean;
  /** HTTP status from the API, or undefined when no response came back. */
  status?: number;
  message: string;
}

/**
 * 429, 5xx and network errors (the request went out, no response came back) are
 * worth retrying. Any other 4xx - bad key, unverified sender, invalid payload,
 * suppressed recipient, no credits - will not fix itself, so retrying only burns
 * attempts. Errors that did not come from axios at all (a missing env var, a bug)
 * are permanent too.
 */
export function classifyError(err: unknown): ClassifiedError {
  const e = err as {
    isAxiosError?: boolean;
    response?: { status?: number; data?: { Error?: string } };
    message?: string;
  };
  const status = e.response?.status;
  const message = e.response?.data?.Error ?? e.message ?? "Unknown error";

  if (!e.isAxiosError) return { retryable: false, message };
  if (status === undefined) return { retryable: true, message };
  return { retryable: status === 429 || status >= 500, status, message };
}
