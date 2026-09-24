import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";
import { convert } from "html-to-text";
import mjml2html from "mjml";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";
const dryRun = process.argv.includes("--dry-run");

// Escape values before they go into HTML, so a name like "<script>" stays text.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Replace {{key}} with the escaped value. Unknown keys throw instead of shipping "Hi {{name}}".
function fill(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Missing template value: ${key}`);
    return escapeHtml(values[key]);
  });
}

// Compile MJML to responsive HTML. The default validation level ("soft") still renders invalid
// markup and lists the problems in `errors`; treat any entry as fatal rather than send broken HTML.
// Placeholders pass through untouched and are filled afterwards, so the compiled template can be
// cached and reused for every send.
const source = await readFile(new URL("../emails/welcome.mjml", import.meta.url), "utf8");
const { html: compiled, errors } = await mjml2html(source);
if (errors.length > 0) {
  console.error("MJML errors:\n" + errors.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}

const html = fill(compiled, { name: "Ann", actionUrl: "https://example.com/start" });
const text = convert(html, {
  wordwrap: 100,
  selectors: [
    { selector: "img", format: "skip" },
    // Skip the hidden <mj-preview> div; inbox previews use it, the text part does not need it.
    { selector: 'div[style^="display:none"]', format: "skip" },
  ],
});

if (dryRun) {
  console.log(`Rendered HTML: ${html.length} characters`);
  console.log("Plain text:\n" + text.split("\n").slice(0, 8).join("\n"));
  process.exit(0);
}

try {
  const { data } = await emailsApi.emailsTransactionalPost({
    Recipients: { To: [to] },
    Content: {
      From: from,
      Subject: "Welcome to Acme, Ann!",
      Body: [
        { ContentType: "HTML", Content: html },
        { ContentType: "PlainText", Content: text },
      ],
    },
  });

  console.log("Email sent successfully!");
  console.log("Transaction ID:", data.TransactionID);
  console.log("Message ID:", data.MessageID);
} catch (err: any) {
  console.error("Error sending email:", err.response?.status, err.response?.data?.Error ?? err.message);
  process.exit(1);
}
