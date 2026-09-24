import "dotenv/config";
import { Inngest, eventType, staticSchema } from "inngest";
import type { EmailMessage } from "./email.js";

// Local dev: INNGEST_DEV=1 points the SDK at `npx inngest-cli@latest dev`.
// Production: set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY instead.
export const inngest = new Inngest({ id: "elasticemail-example" });

export const sendRequested = eventType("email/send.requested", {
  schema: staticSchema<EmailMessage>(),
});

export interface FanoutRecipient {
  id: string;
  email: string;
  name: string;
}

export const fanoutRequested = eventType("email/fanout.requested", {
  schema: staticSchema<{ campaign: string; recipients: FanoutRecipient[] }>(),
});
