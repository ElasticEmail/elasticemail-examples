"""
Suppressions Example

Suppressions are split into unsubscribes, bounces and complaints.
Adding to any list stops future sends to that address.

Usage: python examples/suppressions.py [email]
"""

import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import get_configuration, print_api_error


def fail(step, e):
    print_api_error(step, e)
    sys.exit(1)


def main():
    email = sys.argv[1] if len(sys.argv) > 1 else "suppressed@example.com"
    configuration = get_configuration()

    with ElasticEmail.ApiClient(configuration) as api_client:
        suppressions_api = ElasticEmail.SuppressionsApi(api_client)

        try:
            suppressions_api.suppressions_unsubscribes_post([email])
            print("Added to unsubscribes:", email)
        except ElasticEmail.ApiException as e:
            fail("add unsubscribe", e)

        try:
            s = suppressions_api.suppressions_by_email_get(email)
            print(
                "Suppression:",
                {"Email": s.email, "Reason": s.friendly_error_message, "DateUpdated": s.date_updated},
            )
        except ElasticEmail.ApiException as e:
            fail("get suppression", e)

        try:
            suppressions = suppressions_api.suppressions_get(limit=10, offset=0)
            print("\nAll suppressions (first {}):".format(len(suppressions)))
            for s in suppressions:
                print(" -", s.email, s.friendly_error_message or "")
        except ElasticEmail.ApiException as e:
            fail("list suppressions", e)

        # Remove it again so the address can receive email
        try:
            suppressions_api.suppressions_by_email_delete(email)
            print("\nRemoved from suppressions:", email)
        except ElasticEmail.ApiException as e:
            fail("delete suppression", e)


if __name__ == "__main__":
    main()
