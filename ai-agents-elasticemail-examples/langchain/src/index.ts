import "dotenv/config";
import { createAgent } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { sendEmailTool } from "./email-tool.js";

for (const name of ["ANTHROPIC_API_KEY", "ELASTICEMAIL_API_KEY", "EMAIL_FROM", "EMAIL_TO"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

// ChatAnthropic reads ANTHROPIC_API_KEY from the environment.
const model = new ChatAnthropic({ model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5" });

// createAgent runs the loop: model -> tool call -> tool result -> model, until the model answers.
const agent = createAgent({
  model,
  tools: [sendEmailTool],
  systemPrompt: "You are a helpful assistant that can send email with the send_email tool.",
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        `Send a short welcome email to ${process.env.EMAIL_TO} for a new user of our app. ` +
        "Keep it friendly and under 80 words. Then tell me the transaction ID.",
    },
  ],
});

for (const message of result.messages) {
  console.log(`[${message.type}]`, typeof message.content === "string" ? message.content : JSON.stringify(message.content));
}
