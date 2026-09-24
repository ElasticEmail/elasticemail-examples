package com.elasticemail.examples

import com.elasticemail.api.DomainsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.DomainPayload

fun main(args: Array<String>) {
    val domainsApi = DomainsApi(Ee.client())
    val domain = Ee.env("SENDING_DOMAIN", "yourdomain.com")

    // 1. Add the domain
    try {
        domainsApi.domainsPost(DomainPayload().domain(domain))
        println("Domain \"$domain\" added.")
    } catch (e: ApiException) {
        val body = Ee.errorBody(e).lowercase()
        if (e.code == 400 && ("exist" in body || "already" in body)) {
            println("Domain \"$domain\" already exists.")
        } else {
            Ee.fail("add domain", e)
        }
    }

    // 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
    try {
        val d = domainsApi.domainsByDomainGet(domain)
        println("\nVerification status:")
        println("  SPF:       ${okOrMissing(d.spf)}")
        println("  DKIM:      ${okOrMissing(d.dkim)}")
        println("  MX:        ${okOrMissing(d.mx)}")
        println("  DMARC:     ${okOrMissing(d.dmarc)}")
        println("  Tracking:  ${d.trackingStatus ?: "n/a"}")
        println("  Default:   ${if (d.defaultDomain == true) "yes" else "no"}")
        d.dkIMRecord?.let { dkim ->
            println("\nDKIM record to publish: ${dkim.hostName} TXT ${dkim.recordValue}")
        }
    } catch (e: ApiException) {
        Ee.fail("get domain", e)
    }

    // 3. List all domains
    try {
        val domains = domainsApi.domainsGet()
        println("\nDomains on the account (${domains.size}):")
        for (d in domains) {
            println(" - ${d.domain} spf=${d.spf} dkim=${d.dkim} default=${d.defaultDomain}")
        }
    } catch (e: ApiException) {
        Ee.fail("list domains", e)
    }

    // 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
    // domainsApi.domainsByDomainVerificationPut(domain, "Http")

    // 5. Optional: set the default sender for the account
    // domainsApi.domainsByEmailDefaultPatch("hello@$domain")

    println("\nDone.")
}

private fun okOrMissing(value: Boolean?): String = if (value == true) "ok" else "missing"
