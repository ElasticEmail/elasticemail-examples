// POST /api/domains -> body { domain? } (defaults to SENDING_DOMAIN)
import { defineEventHandler } from "h3";
import { apiError, domainsApi, fail, readJson, sendingDomain } from "../utils/elasticemail";

export default defineEventHandler(async (event) => {
  const body = await readJson(event);
  const domain = body.domain || sendingDomain;

  let alreadyExists = false;
  try {
    await domainsApi.domainsPost({ Domain: domain });
  } catch (err) {
    const { status, message: error } = apiError(err);
    if (status === 400 && /exist|already/i.test(error)) {
      alreadyExists = true;
    } else {
      return fail(event, status, error);
    }
  }

  // Verification happens once the DNS records are published. Re-run to see the flags change.
  try {
    const { data } = await domainsApi.domainsByDomainGet(domain);
    return {
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
    };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return fail(event, status, error);
  }
});
