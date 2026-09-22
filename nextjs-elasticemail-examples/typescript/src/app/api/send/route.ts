// POST /api/send
// Body: { to, subject, message }
import { NextResponse } from "next/server";
import { apiError, emailsApi, from } from "@/lib/elasticemail";

export async function POST(request: Request) {
  const { to, subject, message } = await request.json().catch(() => ({}));

  if (!to || !subject || !message) {
    return NextResponse.json({ error: "Missing required fields: to, subject, message" }, { status: 400 });
  }

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
    });
    return NextResponse.json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return NextResponse.json({ error }, { status });
  }
}
