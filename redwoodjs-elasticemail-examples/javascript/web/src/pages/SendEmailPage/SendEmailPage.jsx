import { Metadata } from "@redwoodjs/web";
import { useState } from "react";
import { PageHeader } from "src/components/PageHeader";
import { ResultDisplay } from "src/components/ResultDisplay";

const exampleCode = `import { Configuration, EmailsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const emailsApi = new EmailsApi(config);

const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: ["you@yourdomain.com"] },
  Content: {
    From: process.env.EMAIL_FROM,
    Subject: "Hello from Elastic Email!",
    Body: [{ ContentType: "HTML", Content: "<p>Hello</p>" }],
  },
});

console.log(data.TransactionID, data.MessageID);`;

const SendEmailPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/.redwood/functions/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: String(form.get("to") ?? ""),
          subject: String(form.get("subject") ?? ""),
          message: String(form.get("message") ?? ""),
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <Metadata title="Basic Send" description="Send a simple HTML email through POST /emails/transactional." />

      <PageHeader
        title="Basic Send Email"
        description="Send a simple HTML email through POST /emails/transactional."
        sourcePath="api/src/functions/send.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@yourdomain.com" />
          <p className="hint">Elastic Email has no sandbox addresses. Send to yourself.</p>
        </div>

        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" name="subject" type="text" required defaultValue="Hello from Elastic Email!" />
        </div>

        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            required
            defaultValue="This is a test email sent from the Elastic Email examples app."
            rows={4}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Email"}
        </button>
      </form>

      <ResultDisplay data={result} loading={loading} title="Email Sent" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
};

export default SendEmailPage;
