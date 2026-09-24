import "dotenv/config";
import { Agent, run } from "@openai/agents";
import { sendEmailTool } from "./email-tool.js";

for (const name of ["OPENAI_API_KEY", "ELASTICEMAIL_API_KEY", "EMAIL_FROM", "EMAIL_TO"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const agent = new Agent({
  name: "Email assistant",
  instructions: "You are a helpful assistant that can send email with the send_email tool.",
  tools: [sendEmailTool],
  // Leave OPENAI_MODEL unset to use the SDK's default model.
  ...(process.env.OPENAI_MODEL ? { model: process.env.OPENAI_MODEL } : {}),
});

// run() loops through tool calls until the agent produces a final answer.
const result = await run(
  agent,
  `Send a short welcome email to ${process.env.EMAIL_TO} for a new user of our app. ` +
    "Keep it friendly and under 80 words. Then tell me the transaction ID.",
);

for (const item of result.newItems) {
  if (item.type === "tool_call_item") console.log("Tool call:", item.rawItem);
  if (item.type === "tool_call_output_item") console.log("Tool result:", item.output);
}
console.log("\n" + result.finalOutput);
