"use node";
// Runs in Convex's Node.js runtime, where the SDK's default axios adapter (node:http) works.
// Files with "use node" may only export actions.
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

let emailsApi: EmailsApi | undefined;
function getEmailsApi(): EmailsApi {
  if (!process.env.ELASTICEMAIL_API_KEY) {
    throw new Error("ELASTICEMAIL_API_KEY is not set. Run: npx convex env set ELASTICEMAIL_API_KEY <key>");
  }
  // Reused while the Node action instance stays warm
  emailsApi ??= new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));
  return emailsApi;
}

/**
 * Internal: callable from other Convex functions (the HTTP action in http.ts, a mutation via
 * ctx.scheduler, a cron), never directly from a client. Returns a result object instead of
 * throwing so the caller gets the Elastic Email status code and message intact.
 */
export const send = internalAction({
  args: { to: v.string(), subject: v.string(), message: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), transactionId: v.union(v.string(), v.null()), messageId: v.union(v.string(), v.null()) }),
    v.object({ ok: v.literal(false), status: v.number(), error: v.string() }),
  ),
  handler: async (_ctx, { to, subject, message }) => {
    try {
      const { data } = await getEmailsApi().emailsTransactionalPost({
        Recipients: { To: [to] },
        Content: {
          From: process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>",
          Subject: subject,
          Body: [
            { ContentType: "HTML", Content: `<p>${message}</p>` },
            { ContentType: "PlainText", Content: message },
          ],
        },
      });
      return { ok: true as const, transactionId: data.TransactionID ?? null, messageId: data.MessageID ?? null };
    } catch (err: any) {
      return {
        ok: false as const,
        status: err.response?.status ?? 500,
        error: String(err.response?.data?.Error ?? err.message ?? "Unknown error"),
      };
    }
  },
});
