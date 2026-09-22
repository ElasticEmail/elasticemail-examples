"""
Double Opt-In: Subscribe

Stores the contact without adding it to the marketing list, then sends a confirmation
email. The confirm link carries an HMAC of the email so the confirm endpoint can trust it.
When the link is opened, GET /double-optin/confirm in flask_app.py adds the contact to the list.

Usage: python examples/double_optin_subscribe.py user@example.com "John Doe"
"""

import hashlib
import hmac
import os
import sys
from urllib.parse import quote

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import FROM, PUBLIC_URL, WEBHOOK_TOKEN, get_configuration, print_api_error

HTML = """<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>{greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="{confirm_url}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>"""


def confirm_token(email):
    return hmac.new(WEBHOOK_TOKEN.encode(), email.encode(), hashlib.sha256).hexdigest()


def main():
    args = sys.argv[1:]
    if not args:
        print('Usage: python examples/double_optin_subscribe.py <email> ["Name"]', file=sys.stderr)
        sys.exit(1)

    email = args[0]
    name = args[1] if len(args) > 1 else ""
    parts = name.split(" ")

    configuration = get_configuration()
    confirm_url = "{}/double-optin/confirm?email={}&token={}".format(
        PUBLIC_URL, quote(email, safe=""), confirm_token(email)
    )
    greeting = "Welcome, {}!".format(name) if name else "Welcome!"

    with ElasticEmail.ApiClient(configuration) as api_client:
        contacts_api = ElasticEmail.ContactsApi(api_client)
        emails_api = ElasticEmail.EmailsApi(api_client)

        try:
            # Step 1: store the contact without adding it to the marketing list.
            # Status "Transactional" allows sending the confirmation but excludes it from campaigns.
            contacts_api.contacts_post(
                [
                    ElasticEmail.ContactPayload(
                        Email=email,
                        FirstName=parts[0],
                        LastName=" ".join(parts[1:]),
                        Status="Transactional",
                    )
                ]
            )
            print("Contact stored (unconfirmed):", email)

            # Step 2: send the confirmation email
            message = ElasticEmail.EmailTransactionalMessageData(
                Recipients=ElasticEmail.TransactionalRecipient(To=[email]),
                Content=ElasticEmail.EmailContent(
                    From=FROM,
                    Subject="Confirm your subscription",
                    Body=[
                        ElasticEmail.BodyPart(
                            ContentType="HTML",
                            Content=HTML.format(greeting=greeting, confirm_url=confirm_url),
                        ),
                        ElasticEmail.BodyPart(
                            ContentType="PlainText",
                            Content="{}\n\nConfirm your subscription: {}".format(greeting, confirm_url),
                        ),
                    ],
                ),
            )
            result = emails_api.emails_transactional_post(message)
            print("Confirmation email sent. Message ID:", result.message_id)
            print("Confirm URL:", confirm_url)
            print("\nWhen the link is opened, GET /double-optin/confirm in flask_app.py adds the contact to the list.")
        except ElasticEmail.ApiException as e:
            print_api_error("double opt-in", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
