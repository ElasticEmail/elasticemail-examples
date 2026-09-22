import { webhookHandler } from "./_lib";

export const config = { runtime: "nodejs" };

export default async function handler(req: Request): Promise<Response> {
  return webhookHandler(req);
}
