// POST /api/send-prevent-threading
// Body: { to, count? }
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, emailsApi, from } from "@/lib/elasticemail";

export async function POST(request) {
  const { to, count = 3 } = await request.json().catch(() => ({}));

  if (!to) {
    return NextResponse.json({ error: "Missing required field: to" }, { status: 400 });
  }

  const total = Math.min(Math.max(Number(count) || 3, 1), 5);
  const messageIds = [];

  // Gmail groups emails into threads based on subject and Message-ID/References headers.
  // A unique X-Entity-Ref-ID header per email prevents this grouping.
  try {
    for (let i = 1; i <= total; i++) {
      const { data } = await emailsApi.emailsTransactionalPost({
        Recipients: { To: [to] },
        Content: {
          From: from,
          Subject: "Order Confirmation", // Same subject for all
          Body: [
            {
              ContentType: "HTML",
              Content: `<h1>Order Confirmation</h1><p>This is email #${i}. Each appears as a separate conversation in Gmail.</p>`,
            },
],
          Headers: {
            "X-Entity-Ref-ID": randomUUID(),
          },
        },
      });
      if (data.MessageID) messageIds.push(data.MessageID);
    }
    return NextResponse.json({ success: true, sent: total, messageIds });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return NextResponse.json({ error, sentBeforeError: messageIds.length }, { status });
  }
}
