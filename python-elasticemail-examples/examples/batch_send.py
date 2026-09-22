"""
Batch Sending Example

Bulk send: one API call, one personalized email per recipient.
Values from Recipients[].Fields replace {placeholders} in the subject and body.
Up to 1000 recipients per request.

Usage: python examples/batch_send.py
"""

import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import FROM, TO, get_configuration, print_api_error


def main():
    configuration = get_configuration()

    recipients = [
        ElasticEmail.EmailRecipient(Email=TO, Fields={"firstname": "Ann", "plan": "Pro"}),
        ElasticEmail.EmailRecipient(Email=TO, Fields={"firstname": "Ben", "plan": "Starter"}),
        ElasticEmail.EmailRecipient(Email=TO, Fields={"firstname": "Cleo", "plan": "Team"}),
    ]

    with ElasticEmail.ApiClient(configuration) as api_client:
        emails_api = ElasticEmail.EmailsApi(api_client)

        message = ElasticEmail.EmailMessageData(
            Recipients=recipients,
            Content=ElasticEmail.EmailContent(
                From=FROM,
                Subject="Hi {firstname}, your {plan} plan is ready",
                Body=[
                    ElasticEmail.BodyPart(
                        ContentType="HTML",
                        Content="<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>",
                    ),
                    ElasticEmail.BodyPart(
                        ContentType="PlainText",
                        Content="Hi {firstname}! Your {plan} plan is now active.",
                    ),
                ],
            ),
        )

        try:
            result = emails_api.emails_post(message)
            print("Bulk email queued for {} recipients.".format(len(recipients)))
            print("Transaction ID:", result.transaction_id)
            print("Check delivery with: python examples/email_status.py", result.transaction_id)
        except ElasticEmail.ApiException as e:
            print_api_error("send bulk email", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
