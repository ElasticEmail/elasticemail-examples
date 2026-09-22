import type { Config, Context } from "@netlify/functions";
import { json } from "../shared";

export default async (_req: Request, _context: Context) => json({ status: "ok" });

export const config: Config = { path: "/health" };
