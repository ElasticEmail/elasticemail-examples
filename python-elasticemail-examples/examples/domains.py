"""
Domain Management Example

Usage: python examples/domains.py
"""

import json
import os
import re
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import SENDING_DOMAIN, get_configuration, print_api_error


def fail(step, e):
    print_api_error(step, e)
    sys.exit(1)


def ok(value):
    return "ok" if value else "missing"


def main():
    configuration = get_configuration()
    domain = SENDING_DOMAIN

    with ElasticEmail.ApiClient(configuration) as api_client:
        domains_api = ElasticEmail.DomainsApi(api_client)

        # 1. Add the domain
        try:
            domains_api.domains_post(ElasticEmail.DomainPayload(Domain=domain))
            print('Domain "{}" added.'.format(domain))
        except ElasticEmail.ApiException as e:
            if e.status == 400 and re.search("exist|already", str(e.body), re.IGNORECASE):
                print('Domain "{}" already exists.'.format(domain))
            else:
                fail("add domain", e)

        # 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
        try:
            data = domains_api.domains_by_domain_get(domain)
            print("\nVerification status:")
            print("  SPF:      ", ok(data.spf))
            print("  DKIM:     ", ok(data.dkim))
            print("  MX:       ", ok(data.mx))
            print("  DMARC:    ", ok(data.dmarc))
            print("  Tracking: ", data.tracking_status if data.tracking_status is not None else "n/a")
            print("  Default:  ", "yes" if data.default_domain else "no")
            if data.dkim_record:
                print("\nDKIM record to publish:", json.dumps(data.dkim_record))
        except ElasticEmail.ApiException as e:
            fail("get domain", e)

        # 3. List all domains
        try:
            domains = domains_api.domains_get()
            print("\nDomains on the account ({}):".format(len(domains)))
            for d in domains:
                print(" - {} spf={} dkim={} default={}".format(d.domain, d.spf, d.dkim, d.default_domain))
        except ElasticEmail.ApiException as e:
            fail("list domains", e)

        # 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
        # domains_api.domains_by_domain_verification_put(domain, "Http")

        # 5. Optional: set the default sender for the account
        # domains_api.domains_by_email_default_patch("hello@" + domain)

    print("\nDone.")


if __name__ == "__main__":
    main()
