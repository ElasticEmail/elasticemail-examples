// GET  /api/domains             -> all domains on the account
// POST /api/domains             -> body { domain? } (defaults to SENDING_DOMAIN)

import { apiError, domainsApi, json, readJson, sendingDomain } from "../../lib/elasticemail";

export const GET = async () => {
  try {
    const { data } = await domainsApi.domainsGet();
    return json({
      total: data.length,
      domains: data.map((d) => ({
        Domain: d.Domain,
        Spf: d.Spf,
        Dkim: d.Dkim,
        MX: d.MX,
        DMARC: d.DMARC,
        TrackingStatus: d.TrackingStatus,
        DefaultDomain: d.DefaultDomain,
      })),
    });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, status);
  }
};

export const POST = async ({ request }) => {
  const body = await readJson(request);
  const domain = body.domain || sendingDomain;

  let alreadyExists = false;
  try {
    await domainsApi.domainsPost({ Domain: domain });
  } catch (err) {
    const { status, message: error } = apiError(err);
    if (status === 400 && /exist|already/i.test(error)) {
      alreadyExists = true;
    } else {
      return json({ error }, status);
    }
  }

  // Verification happens once the DNS records are published. Re-run to see the flags change.
  try {
    const { data } = await domainsApi.domainsByDomainGet(domain);
    return json({
      success: true,
      domain: data.Domain,
      alreadyExists,
      verification: {
        Spf: data.Spf,
        Dkim: data.Dkim,
        MX: data.MX,
        DMARC: data.DMARC,
        TrackingStatus: data.TrackingStatus,
        DefaultDomain: data.DefaultDomain,
      },
      DKIMRecord: data.DKIMRecord,
    });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return json({ error }, status);
  }
};
