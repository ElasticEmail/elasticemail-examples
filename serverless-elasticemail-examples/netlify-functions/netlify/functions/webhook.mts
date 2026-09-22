import type { Config, Context } from "@netlify/functions";
import { webhookHandler } from "../shared";

export default async (req: Request, _context: Context) =>
  webhookHandler(req, process.env.ELASTICEMAIL_WEBHOOK_TOKEN);

export const config: Config = { path: "/webhook" };
