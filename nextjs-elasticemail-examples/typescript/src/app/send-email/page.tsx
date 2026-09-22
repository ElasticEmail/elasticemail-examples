"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";

export default function SendEmailPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Hello from Elastic Email!");
  const [message, setMessage] = useState("This is a test email sent from the Elastic Email examples app.");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ data?: unknown; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message }),
      });
      const data = await response.json();
      setResult(response.ok ? { data } : { error: data.error || "Failed to send email" });
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const exampleCode = `import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: ["${to || "you@yourdomain.com"}"] },
  Content: {
    From: process.env.EMAIL_FROM,
    Subject: "${subject}",
    Body: [{ ContentType: "HTML", Content: "<p>${message}</p>" }],
  },
});

console.log(data.TransactionID, data.MessageID);`;

  return (
    <main>
      <PageHeader
        title="Basic Send Email"
        description="Send a simple HTML email through POST /emails/transactional."
        sourcePath="src/app/send-email/page.tsx"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="you@yourdomain.com" />
          <p className="hint">Elastic Email has no sandbox addresses. Send to yourself.</p>
        </div>

        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Email"}
        </button>
      </form>

      <ResultDisplay data={result?.data} error={result?.error} loading={loading} title="Email Sent" />

      <h2>Code Example</h2>
      <CodeBlock code={exampleCode} title="src/app/api/send/route.ts" />
    </main>
  );
}
