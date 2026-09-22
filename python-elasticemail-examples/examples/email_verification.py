"""
Email Verification Example

Email verification is a paid feature. Accounts without it get a 4xx here.

Usage: python examples/email_verification.py someone@example.com
"""

import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import TO, get_configuration, print_api_error


def main():
    email = sys.argv[1] if len(sys.argv) > 1 else TO
    configuration = get_configuration()

    with ElasticEmail.ApiClient(configuration) as api_client:
        verifications_api = ElasticEmail.VerificationsApi(api_client)

        try:
            verifications_api.verifications_by_email_post(email)
            data = verifications_api.verifications_by_email_get(email)

            print("=== Verification result ===")
            print("Email:      ", data.email)
            print("Result:     ", data.result)
            print("Reason:     ", data.reason or "")
            print("Disposable: ", data.disposable)
            print("Role:       ", data.role)
            if data.suggested_spelling:
                print("Did you mean:", data.suggested_spelling)
        except ElasticEmail.ApiException as e:
            print_api_error("verify email", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
