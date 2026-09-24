import "dotenv/config";
import { generateText, isStepCount } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { sendEmailTool } from "./email-tool.js";

for (const name of ["ANTHROPIC_API_KEY", "ELASTICEMAIL_API_KEY", "EMAIL_FROM", "EMAIL_TO"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const result = await generateText({
  model: anthropic(process.env.ANTHROPIC_MODEL || "claude-opus-5-5"),
  tools: { send_email: sendEmailTool },
  // Let the model call the tool, read its result, then write a final answer.
  stopWhen: isStepCount(5),
  instructions: "You are a helpful assistant that can send email with the send_email tool.",
  prompt:
    `Send a short welcome email to ${process.env.EMAIL_TO} for a new user of our app. ` +
    "Keep it friendly and under 80 words. Then tell me the transaction ID.",
});

for (const step of result.steps) {
  for (const call of step.toolCalls) console.log("Tool call:", call.toolName, call.input);
  for (const res of step.toolResults) console.log("Tool result:", res.output);
}
console.log("\n" + result.text);
