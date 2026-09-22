package com.elasticemail.examples;

import com.elasticemail.api.DomainsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.DKIMRecord;
import com.elasticemail.model.DomainData;
import com.elasticemail.model.DomainDetail;
import com.elasticemail.model.DomainPayload;

import java.util.List;

public class Domains {
    public static void main(String[] args) {
        DomainsApi domainsApi = new DomainsApi(Ee.client());
        String domain = Ee.env("SENDING_DOMAIN", "yourdomain.com");

        // 1. Add the domain
        try {
            domainsApi.domainsPost(new DomainPayload().domain(domain));
            System.out.println("Domain \"" + domain + "\" added.");
        } catch (ApiException e) {
            String body = Ee.errorBody(e).toLowerCase();
            if (e.getCode() == 400 && (body.contains("exist") || body.contains("already"))) {
                System.out.println("Domain \"" + domain + "\" already exists.");
            } else {
                fail("add domain", e);
            }
        }

        // 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
        try {
            DomainData d = domainsApi.domainsByDomainGet(domain);
            System.out.println("\nVerification status:");
            System.out.println("  SPF:       " + okOrMissing(d.getSpf()));
            System.out.println("  DKIM:      " + okOrMissing(d.getDkim()));
            System.out.println("  MX:        " + okOrMissing(d.getMX()));
            System.out.println("  DMARC:     " + okOrMissing(d.getDMARC()));
            System.out.println("  Tracking:  " + (d.getTrackingStatus() == null ? "n/a" : d.getTrackingStatus()));
            System.out.println("  Default:   " + (Boolean.TRUE.equals(d.getDefaultDomain()) ? "yes" : "no"));
            DKIMRecord dkim = d.getDkIMRecord();
            if (dkim != null) {
                System.out.println("\nDKIM record to publish: " + dkim.getHostName() + " TXT " + dkim.getRecordValue());
            }
        } catch (ApiException e) {
            fail("get domain", e);
        }

        // 3. List all domains
        try {
            List<DomainDetail> domains = domainsApi.domainsGet();
            System.out.println("\nDomains on the account (" + domains.size() + "):");
            for (DomainDetail d : domains) {
                System.out.println(" - " + d.getDomain() + " spf=" + d.getSpf() + " dkim=" + d.getDkim()
                        + " default=" + d.getDefaultDomain());
            }
        } catch (ApiException e) {
            fail("list domains", e);
        }

        // 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
        // domainsApi.domainsByDomainVerificationPut(domain, "Http");

        // 5. Optional: set the default sender for the account
        // domainsApi.domainsByEmailDefaultPatch("hello@" + domain);

        System.out.println("\nDone.");
    }

    private static String okOrMissing(Boolean value) {
        return Boolean.TRUE.equals(value) ? "ok" : "missing";
    }

    private static void fail(String step, ApiException e) {
        Ee.printApiError(step, e);
        System.exit(1);
    }
}
