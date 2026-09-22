"""
Sub-Accounts Example

Sub-accounts let you isolate customers or projects with their own API keys and credits.
Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.

Usage: python examples/sub_accounts.py
"""

import os
import secrets
import sys
import time

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import get_configuration, print_api_error


def fail(step, e):
    print_api_error(step, e)
    sys.exit(1)


def main():
    configuration = get_configuration()
    create_enabled = os.environ.get("CREATE_SUBACCOUNT") == "true"
    sub_email = os.environ.get("SUBACCOUNT_EMAIL") or "sub-{}@example.com".format(int(time.time() * 1000))

    with ElasticEmail.ApiClient(configuration) as api_client:
        sub_accounts_api = ElasticEmail.SubAccountsApi(api_client)

        try:
            accounts = sub_accounts_api.subaccounts_get(limit=20, offset=0)
            print("Sub-accounts ({}):".format(len(accounts)))
            for s in accounts:
                print(" - {} status={} credits={} sent={}".format(s.email, s.status, s.email_credits, s.total_emails_sent))
        except ElasticEmail.ApiException as e:
            fail("list sub-accounts", e)

        if not create_enabled:
            print("\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.")
            return

        try:
            account = sub_accounts_api.subaccounts_post(
                ElasticEmail.SubaccountPayload(
                    Email=sub_email,
                    Password="Tmp-{}-Aa1!".format(secrets.token_urlsafe(12)),
                    SendActivation=False,
                )
            )
            print("\nSub-account created:", account.email)

            sub_accounts_api.subaccounts_by_email_credits_patch(
                sub_email,
                ElasticEmail.SubaccountEmailCreditsPayload(Credits=1000, Notes="Initial allocation"),
            )
            print("Assigned 1000 credits to", sub_email)

            key = sub_accounts_api.subaccounts_by_email_apikey_get(sub_email)
            print("Sub-account API key retrieved (length):", len(key))
        except ElasticEmail.ApiException as e:
            fail("create sub-account", e)


if __name__ == "__main__":
    main()
