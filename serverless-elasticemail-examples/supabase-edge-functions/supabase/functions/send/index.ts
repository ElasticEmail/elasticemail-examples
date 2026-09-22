import axios from "npm:axios@1.18.1";
import { Configuration, EmailsApi } from "npm:@elasticemail/elasticemail-client-ts-axios@4.2.0";

const apiKey = Deno.env.get("ELASTICEMAIL_API_KEY");
if (!apiKey) {
  throw new Error("ELASTICEMAIL_API_KEY is not set. Run: supabase secrets set ELASTICEMAIL_API_KEY=...");
}
const from = Deno.env.get("EMAIL_FROM") || "Acme <hello@yourdomain.com>";

// Deno has no node:http for axios to use by default, so route requests through fetch.
const emailsApi = new EmailsApi(new Configuration({ apiKey }), undefined, axios.create({ adapter: "fetch" }));

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return json({ status: "ok" });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { to, subject, message } = (await req.json().catch(() => ({}))) ?? {};
  if (!to || !subject || !message) {
    return json({ error: "Missing required fields: to, subject, message" }, 400);
  }

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: subject,
        Body: [{ ContentType: "HTML", Content: `<p>${message}</p>` }],
      },
    });
    return json({ success: true, transactionId: data.TransactionID, messageId: data.MessageID });
  } catch (err: any) {
    return json(
      { error: err.response?.data?.Error ?? err.message ?? "Unknown error" },
      err.response?.status ?? 500,
    );
  }
});
