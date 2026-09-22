// POST /api/send-scheduled
// Body: { to, delayMinutes? }
import { NextResponse } from "next/server";
import { apiError, emailsApi, from } from "@/lib/elasticemail";

// TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
// Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
const maxOffset = 50400;

export async function POST(request: Request) {
  const { to, delayMinutes = 60 } = await request.json().catch(() => ({}));

  if (!to) {
    return NextResponse.json({ error: "Missing required field: to" }, { status: 400 });
  }

  const offset = Number(delayMinutes);
  if (!Number.isInteger(offset) || offset < 1 || offset > maxOffset) {
    return NextResponse.json({ error: `delayMinutes must be between 1 and ${maxOffset}` }, { status: 400 });
  }

  const scheduledFor = new Date(Date.now() + offset * 60 * 1000);

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: "Scheduled Email",
        Body: [
          {
            ContentType: "HTML",
            Content: `<h1>Scheduled Email</h1><p>This email was scheduled for ${scheduledFor.toISOString()}.</p>`,
          },
        ],
      },
      Options: { TimeOffset: offset },
    });
    return NextResponse.json({
      success: true,
      transactionId: data.TransactionID,
      messageId: data.MessageID,
      scheduledFor: scheduledFor.toISOString(),
    });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return NextResponse.json({ error }, { status });
  }
}
