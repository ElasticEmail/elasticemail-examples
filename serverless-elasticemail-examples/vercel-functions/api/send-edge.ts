import { createEmailsApi, sendHandler } from "./_lib";

// Same endpoint on the Edge runtime. No node:http there, so axios uses the fetch adapter.
export const runtime = "edge";

export default async function handler(req: Request): Promise<Response> {
  return sendHandler(req, createEmailsApi(true));
}
