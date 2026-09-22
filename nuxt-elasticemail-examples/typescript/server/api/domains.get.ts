// GET /api/domains -> all domains on the account
import { defineEventHandler } from "h3";
import { apiError, domainsApi, fail } from "../utils/elasticemail";

export default defineEventHandler(async (event) => {
  try {
    const { data } = await domainsApi.domainsGet();
    return {
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
    };
  } catch (err) {
    const { status, message: error } = apiError(err);
    return fail(event, status, error);
  }
});
