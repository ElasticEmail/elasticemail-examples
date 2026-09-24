import { tool } from "ai";
import { z } from "zod";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const emailsApi = new EmailsApi(new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY }));

export type SendEmailInput = { to: string; subject: string; text: string; html?: string };
export type SendEmailResult = { transactionId?: string; messageId?: string } | { error: string };

// A model can be steered by text it reads (a web page, an inbound email, a user message),
// so the tool itself decides who may receive mail. Default: the domain of EMAIL_TO only.
function allowedDomains(): string[] {
  const list = process.env.EMAIL_ALLOWED_DOMAINS || process.env.EMAIL_TO?.split("@")[1] || "";
  return list
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function recipientAllowed(email: string): boolean {
  if (/\s/.test(email) || email.split("@").length !== 2) return false;
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return allowedDomains().includes(domain);
}

// Elastic Email treats `{...}` and `{{...}}` in message content as template syntax, so strip braces from user input.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

function plainText(s: string): string {
  return s.replace(/[{}]/g, "");
}

function headerText(s: string): string {
  return plainText(s).replace(/[\r\n]/g, "");
}

// Model-written HTML is kept as is, except braces, which become HTML entities.
function neutralizeBraces(html: string): string {
  return html.replace(/{/g, "&#123;").replace(/}/g, "&#125;");
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<SendEmailResult> {
  if (!recipientAllowed(to)) {
    return { error: `Recipient not allowed: ${headerText(to)}. Allowed domains: ${allowedDomains().join(", ") || "(none)"}` };
  }

  const from = process.env.EMAIL_FROM;
  if (!from) return { error: "EMAIL_FROM is not set" };

  try {
    const { data } = await emailsApi.emailsTransactionalPost({
      Recipients: { To: [to] },
      Content: {
        From: from,
        Subject: headerText(subject),
        Body: [
          { ContentType: "HTML", Content: html ? neutralizeBraces(html) : textToHtml(text) },
          { ContentType: "PlainText", Content: plainText(text) },
        ],
      },
    });
    return { transactionId: data.TransactionID, messageId: data.MessageID };
  } catch (err: any) {
    // Hand the model the API's own message ({"Error": "..."}), not a raw axios error.
    const status = err.response?.status;
    const message = err.response?.data?.Error ?? err.message ?? "Unknown error";
    return { error: status ? `Elastic Email API ${status}: ${message}` : String(message) };
  }
}

export const sendEmailTool = tool({
  description:
    "Send one transactional email through Elastic Email. Only recipients on allowed domains are accepted; " +
    "if the result contains an error, report it instead of retrying with a different address.",
  inputSchema: z.object({
    to: z.email().describe("Recipient email address"),
    subject: z.string().min(1).describe("Subject line"),
    text: z.string().min(1).describe("Plain-text body"),
    html: z.string().optional().describe("Optional HTML body. Derived from text when omitted."),
  }),
  execute: sendEmail,
});
