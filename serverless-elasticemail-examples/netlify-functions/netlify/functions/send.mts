import type { Config, Context } from "@netlify/functions";
import { createEmailsApi, sendHandler } from "../shared";

export default async (req: Request, _context: Context) =>
  sendHandler(req, createEmailsApi(process.env.ELASTICEMAIL_API_KEY), process.env.EMAIL_FROM);

export const config: Config = { path: "/send" };
