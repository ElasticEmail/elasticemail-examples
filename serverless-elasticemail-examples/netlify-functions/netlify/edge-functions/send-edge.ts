import type { Config, Context } from "@netlify/edge-functions";
import { createEmailsApi, sendHandler } from "../shared.ts";

// Same endpoint as /send but on Netlify Edge Functions (Deno). Env vars come from Netlify.env,
// and axios must use the fetch adapter because there is no node:http.
export default async (req: Request, _context: Context) =>
  sendHandler(
    req,
    createEmailsApi(Netlify.env.get("ELASTICEMAIL_API_KEY"), true),
    Netlify.env.get("EMAIL_FROM"),
  );

export const config: Config = { path: "/send-edge" };
