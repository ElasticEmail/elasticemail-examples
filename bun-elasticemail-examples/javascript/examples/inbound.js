import { Configuration, InboundRouteApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const inboundApi = new InboundRouteApi(config);

const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
const token = process.env.ELASTICEMAIL_WEBHOOK_TOKEN || "change_me";
const domain = process.env.SENDING_DOMAIN || "yourdomain.com";

// Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
// Matching emails are parsed and POSTed as form fields to HttpAddress
// (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
// See src/index.js for the receiving handler.

const fail = (step, err) => {
  console.error(`Error (${step}):`, err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
};

let routeId;
try {
  const { data } = await inboundApi.inboundroutePost({
    Name: "examples-inbound",
    Filter: `*@${domain}`,
    FilterType: "EmailAddress",
    ActionType: "NotifyViaHttp",
    HttpAddress: `${publicUrl}/inbound?token=${encodeURIComponent(token)}`,
  });
  routeId = data.PublicId;
  console.log("Inbound route created:", routeId, data.Filter, "->", data.ActionParameter);
} catch (err) {
  fail("create route", err);
}

try {
  const { data } = await inboundApi.inboundrouteGet();
  console.log(`\nInbound routes (${data.length}):`);
  for (const r of data) {
    console.log(` - [${r.SortOrder}] ${r.PublicId} ${r.Name}: ${r.FilterType}=${r.Filter} ${r.ActionType} ${r.ActionParameter ?? ""}`);
  }
} catch (err) {
  fail("list routes", err);
}

// Delete the route we created (comment out to keep it)
if (routeId) {
  try {
    await inboundApi.inboundrouteByIdDelete(routeId);
    console.log("\nInbound route deleted:", routeId);
  } catch (err) {
    fail("delete route", err);
  }
}
