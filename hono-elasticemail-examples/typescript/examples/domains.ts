import "dotenv/config";
import { Configuration, DomainsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const domainsApi = new DomainsApi(config);

const domain = process.env.SENDING_DOMAIN || "yourdomain.com";

const fail = (step: string, err: any) => {
  console.error(`Error (${step}):`, err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
};

// 1. Add the domain
try {
  await domainsApi.domainsPost({ Domain: domain });
  console.log(`Domain "${domain}" added.`);
} catch (err: any) {
  if (err.response?.status === 400 && /exist|already/i.test(JSON.stringify(err.response?.data))) {
    console.log(`Domain "${domain}" already exists.`);
  } else {
    fail("add domain", err);
  }
}

// 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
try {
  const { data } = await domainsApi.domainsByDomainGet(domain);
  console.log("\nVerification status:");
  console.log("  SPF:      ", data.Spf ? "ok" : "missing");
  console.log("  DKIM:     ", data.Dkim ? "ok" : "missing");
  console.log("  MX:       ", data.MX ? "ok" : "missing");
  console.log("  DMARC:    ", data.DMARC ? "ok" : "missing");
  console.log("  Tracking: ", data.TrackingStatus ?? "n/a");
  console.log("  Default:  ", data.DefaultDomain ? "yes" : "no");
  if (data.DKIMRecord) {
    console.log("\nDKIM record to publish:", JSON.stringify(data.DKIMRecord));
  }
} catch (err: any) {
  fail("get domain", err);
}

// 3. List all domains
try {
  const { data } = await domainsApi.domainsGet();
  console.log(`\nDomains on the account (${data.length}):`);
  for (const d of data) {
    console.log(` - ${d.Domain} spf=${d.Spf} dkim=${d.Dkim} default=${d.DefaultDomain}`);
  }
} catch (err: any) {
  fail("list domains", err);
}

// 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
// await domainsApi.domainsByDomainVerificationPut(domain, "Http");

// 5. Optional: set the default sender for the account
// await domainsApi.domainsByEmailDefaultPatch(`hello@${domain}`);

console.log("\nDone.");
