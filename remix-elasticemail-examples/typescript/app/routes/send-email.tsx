import type { MetaFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { PageHeader } from "../components/PageHeader";
import { ResultDisplay, type ApiResult } from "../components/ResultDisplay";

export const meta: MetaFunction = () => [{ title: "Basic Send - Elastic Email Examples" }];

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

export default function SendEmail() {
  const fetcher = useFetcher<ApiResult>();
  const loading = fetcher.state !== "idle";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fetcher.submit(
      { to: String(form.get("to")), subject: String(form.get("subject")), message: String(form.get("message")) },
      { method: "post", action: "/api/send", encType: "application/json" },
    );
  };

  return (
    <main>
      <PageHeader
        title="Basic Send Email"
        description="Send a simple HTML email through POST /emails/transactional."
        sourcePath="app/routes/api.send.ts"
      />

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="email" required placeholder="you@yourdomain.com" />
          <p className="hint">Elastic Email has no sandbox addresses. Send to yourself.</p>
        </div>

        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" name="subject" type="text" defaultValue="Hello from Elastic Email!" required />
        </div>

        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            defaultValue="This is a test email sent from the Elastic Email examples app."
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Email"}
        </button>
      </form>

      <ResultDisplay data={fetcher.data} loading={loading} title="Email Sent" />

      <h2>Code Example</h2>
      <div className="code-block">
        <pre>
          <code>{exampleCode}</code>
        </pre>
      </div>
    </main>
  );
}
