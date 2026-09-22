const secret = Deno.env.get("ELASTICEMAIL_WEBHOOK_TOKEN") || "change_me";

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** Strip newlines from user-controlled values before logging */
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");

/** Constant-time string compare */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** Elastic Email webhooks are form-encoded; JSON is accepted too. */
async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return await req.json();
  if (type.includes("form")) {
    const out: Record<string, string> = {};
    (await req.formData()).forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  }
  return {};
}

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (!safeEqual(url.searchParams.get("token") ?? "", secret)) {
    return json({ error: "Invalid token" }, 401);
  }

  const body = req.method === "POST" ? await readBody(req) : {};
  const event = { ...Object.fromEntries(url.searchParams), ...body };
  const status = sanitize(event.status);

  if (!status) {
    return json({ ok: true });
  }

  console.log("Webhook event:", status, "to:", sanitize(event.to), "transaction:", sanitize(event.transaction));
  switch (status) {
    case "Sent":
      console.log("Email sent, message id:", sanitize(event.messageid));
      break;
    case "Opened":
      console.log("Email opened from", sanitize(event.Country), sanitize(event.City));
      break;
    case "Clicked":
      console.log("Link clicked:", sanitize(event.target));
      break;
    case "Error":
      console.log("Bounce/error, category:", sanitize(event.category));
      break;
    case "AbuseReport":
      console.log("Complaint received");
      break;
    case "Unsubscribed":
      console.log("Recipient unsubscribed");
      break;
  }

  return json({ received: true, status });
});
