// POST /api/inbound?token=...
//
// Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
import { NextResponse } from "next/server";
import { apiError, contactEmail, emailsApi, from, readEvent, sanitize, tokenOk } from "@/lib/elasticemail";

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!tokenOk(url.searchParams.get("token"))) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const mail = await readEvent(request);
  const attachments = Object.keys(mail)
    .filter((k) => /^att\d+_name$/.test(k))
    .map((k) => ({ name: mail[k], content: mail[k.replace("_name", "_content")] }));

  console.log("Inbound email from:", sanitize(mail.from_email), "subject:", sanitize(mail.subject));
  console.log("Attachments:", attachments.map((a) => a.name).join(", ") || "none");

  // Forward a copy to the team inbox
  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [contactEmail] },
      Content: {
        From: from,
        ReplyTo: mail.from_email,
        Subject: `Fwd: ${mail.subject ?? "(no subject)"}`,
        Body: [
          {
            ContentType: "HTML",
            Content: mail.body_html || `<pre>${(mail.body_text ?? "").replace(/</g, "&lt;")}</pre>`,
          },
        ],
        Attachments: attachments
          .filter((a) => a.content)
          .map((a) => ({ Name: a.name, BinaryContent: a.content })),
      },
    });
    return NextResponse.json({ received: true, attachments: attachments.length, forwardedMessageId: data.MessageID });
  } catch (err) {
    const { status, message } = apiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
