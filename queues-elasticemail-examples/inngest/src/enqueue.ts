import "dotenv/config";
import { fanoutRequested, inngest, sendRequested } from "./client.js";

const to = process.env.EMAIL_TO;
if (!to) {
  console.error("EMAIL_TO is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// In your app, this is the line that replaces the inline send in a request
// handler: it returns as soon as Inngest has stored the event.
if (process.argv.includes("--fanout")) {
  // All three go to EMAIL_TO here; in your app, load them from your database.
  const { ids } = await inngest.send(
    fanoutRequested.create({
      campaign: "welcome-2026-09",
      recipients: [
        { id: "user-1", email: to, name: "Ann" },
        { id: "user-2", email: to, name: "Ben" },
        { id: "user-3", email: to, name: "Cleo" },
      ],
    }),
  );
  console.log("Fan-out event sent:", ids.join(", "));
} else {
  const { ids } = await inngest.send(
    sendRequested.create({
      to,
      subject: "Hello from a background job",
      html: "<h1>Hello!</h1><p>This email was sent by an Inngest function through Elastic Email.</p>",
      text: "Hello! This email was sent by an Inngest function through Elastic Email.",
    }),
  );
  console.log("Event sent:", ids.join(", "), "- watch the run at http://localhost:8288");
}
