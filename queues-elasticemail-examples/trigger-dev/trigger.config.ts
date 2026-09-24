import "dotenv/config";
import { defineConfig } from "@trigger.dev/sdk";

const project = process.env.TRIGGER_PROJECT_REF;
if (!project) {
  throw new Error("TRIGGER_PROJECT_REF is not set. Copy it from Project settings in the Trigger.dev dashboard.");
}

export default defineConfig({
  project,
  dirs: ["./src/trigger"],
  // Seconds of compute a single run may use before it is stopped.
  maxDuration: 60,
  retries: {
    // Retry in `trigger dev` too, so you see the same behavior locally.
    // Each task sets its own retry policy (see src/trigger/send-email.ts).
    enabledInDev: true,
  },
});
