// POST /api/send
// Body: { to, subject, message }
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, emailsApi, from } from "@/lib/elasticemail";

export async function POST(request) {
  const { to, subject, message } = await request.json().catch(() => ({}));

  if (!to || !subject || !message) {
    return NextResponse.json({ error: "Missing required fields: to, subject, message" }, { status: 400 });
  }

  // Forward the caller's Idempotency-Key so its retries can't send twice; otherwise use a new key.
  const idempotencyKey = request.headers.get("Idempotency-Key") || randomUUID();

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [
          { ContentType: "HTML", Content: `<p>${message}</p>` },
          { ContentType: "PlainText", Content: message },
],
      },
    }, idempotencyKey);
    return NextResponse.json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return NextResponse.json({ error }, { status });
  }
}
