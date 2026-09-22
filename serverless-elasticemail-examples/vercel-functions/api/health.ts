import { json } from "./_lib";

export const config = { runtime: "nodejs" };

export default async function handler(): Promise<Response> {
  return json({ status: "ok" });
}
