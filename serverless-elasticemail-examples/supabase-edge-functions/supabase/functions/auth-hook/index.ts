import axios from "npm:axios@1.18.1";
import { Configuration, EmailsApi } from "npm:@elasticemail/elasticemail-client-ts-axios@4.2.0";

// Supabase Auth "Send Email" hook. Supabase POSTs here instead of using its built-in
// mailer and the function is responsible for delivering the message.
// Payload: { user: { email, ... }, email_data: { token, token_hash, redirect_to, email_action_type, site_url } }
// email_action_type is one of: signup, invite, magiclink, recovery, email_change, email_change_new, reauthentication.

const apiKey = Deno.env.get("ELASTICEMAIL_API_KEY");
if (!apiKey) {
  throw new Error("ELASTICEMAIL_API_KEY is not set. Run: supabase secrets set ELASTICEMAIL_API_KEY=...");
}
const from = Deno.env.get("EMAIL_FROM") || "Acme <hello@yourdomain.com>";
// Optional: the hook secret shown in the dashboard (format "v1,whsec_..."). When set, requests
// without a matching webhook-signature header are rejected. Verification uses the Standard Webhooks
// scheme: HMAC-SHA256 over "<id>.<timestamp>.<body>" with the base64-decoded secret.
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

const emailsApi = new EmailsApi(new Configuration({ apiKey }), undefined, axios.create({ adapter: "fetch" }));

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

interface HookPayload {
  user: { email: string; user_metadata?: Record<string, unknown> };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function buildVerifyUrl(d: HookPayload["email_data"], type = d.email_action_type): string {
  const base = d.site_url.replace(/\/$/, "");
  return `${base}/auth/v1/verify?token=${encodeURIComponent(d.token_hash)}&type=${type}&redirect_to=${encodeURIComponent(d.redirect_to)}`;
}

function buildMessage(payload: HookPayload): { subject: string; html: string } {
  const d = payload.email_data;
  const link = buildVerifyUrl(d);
  switch (d.email_action_type) {
    case "signup":
      return {
        subject: "Confirm your email",
        html: `<p>Confirm your address by clicking <a href="${link}">this link</a>.</p><p>Or enter the code: <strong>${d.token}</strong></p>`,
      };
    case "invite":
      return { subject: "You have been invited", html: `<p><a href="${link}">Accept the invitation</a></p>` };
    case "magiclink":
      return {
        subject: "Your sign-in link",
        html: `<p><a href="${link}">Sign in</a></p><p>Or enter the code: <strong>${d.token}</strong></p>`,
      };
    case "recovery":
      return { subject: "Reset your password", html: `<p><a href="${link}">Reset password</a></p>` };
    case "email_change":
    case "email_change_new":
      return {
        subject: "Confirm your new email address",
        html: `<p><a href="${buildVerifyUrl(d, "email_change")}">Confirm the change</a></p>`,
      };
    case "reauthentication":
      return { subject: "Your verification code", html: `<p>Code: <strong>${d.token}</strong></p>` };
    default:
      return { subject: "Account notification", html: `<p><a href="${link}">Continue</a></p>` };
  }
}

async function verifySignature(req: Request, body: string): Promise<boolean> {
  if (!hookSecret) return true;
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sig = req.headers.get("webhook-signature");
  if (!id || !ts || !sig) return false;

  const raw = Uint8Array.from(atob(hookSecret.replace(/^v1,whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sig.split(" ").some((part) => part.replace(/^v1,/, "") === expected);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.text();
  if (!(await verifySignature(req, body))) {
    return json({ error: "Invalid hook signature" }, 401);
  }

  const payload = JSON.parse(body) as HookPayload;
  const to = payload.user.email;
  const { subject, html } = buildMessage(payload);

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: { From: from, Subject: subject, Body: [{ ContentType: "HTML", Content: html }] },
    });
    console.log("Auth email sent:", payload.email_data.email_action_type, "message id:", data.MessageID);
    // Supabase expects an empty 200 JSON object on success
    return json({});
  } catch (err: any) {
    const message = err.response?.data?.Error ?? err.message ?? "Unknown error";
    console.error("Elastic Email error:", message);
    // Supabase surfaces this shape to the client
    return json({ error: { http_code: err.response?.status ?? 500, message } }, 500);
  }
});
