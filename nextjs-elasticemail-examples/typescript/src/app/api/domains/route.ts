// GET  /api/domains             -> all domains on the account
// POST /api/domains             -> body { domain? } (defaults to SENDING_DOMAIN)
import { NextResponse } from "next/server";
import { apiError, domainsApi, sendingDomain } from "@/lib/elasticemail";

export async function GET() {
  try {
    const { data } = await domainsApi.domainsGet();
    return NextResponse.json({
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
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const domain: string = body.domain || sendingDomain;

  let alreadyExists = false;
  try {
    await domainsApi.domainsPost({ Domain: domain });
  } catch (err) {
    const { status, message: error } = apiError(err);
    if (status === 400 && /exist|already/i.test(error)) {
      alreadyExists = true;
    } else {
      return NextResponse.json({ error }, { status });
    }
  }

  // Verification happens once the DNS records are published. Re-run to see the flags change.
  try {
    const { data } = await domainsApi.domainsByDomainGet(domain);
    return NextResponse.json({
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
    return NextResponse.json({ error }, { status });
  }
}
