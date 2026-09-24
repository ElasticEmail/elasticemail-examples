import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { apiError, getEmailsApi } from "../lib.js";

export async function send(req: HttpRequest): Promise<HttpResponseInit> {
  const { to, subject, message } = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, string>;
  if (!to || !subject || !message) {
    return { status: 400, jsonBody: { error: "Missing required fields: to, subject, message" } };
  }

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
    return { jsonBody: { success: true, transactionId: data.TransactionID, messageId: data.MessageID } };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return { status, jsonBody: { error } };
  }
}

app.http("send", {
  methods: ["POST"],
  // Callers must pass the function key (?code= or x-functions-key header) once deployed.
  // `func start` does not enforce keys, so local curl tests work without one.
  authLevel: "function",
  route: "send",
  handler: send,
});
