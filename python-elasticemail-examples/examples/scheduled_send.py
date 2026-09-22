"""
Scheduled Sending Example

TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.

Usage: python examples/scheduled_send.py
"""

import datetime
import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import FROM, TO, get_configuration, print_api_error

DELAY_MINUTES = 60


def main():
    configuration = get_configuration()
    scheduled_for = datetime.datetime.utcnow() + datetime.timedelta(minutes=DELAY_MINUTES)
    scheduled_iso = scheduled_for.replace(microsecond=0).isoformat() + "Z"

    with ElasticEmail.ApiClient(configuration) as api_client:
        emails_api = ElasticEmail.EmailsApi(api_client)

        message = ElasticEmail.EmailTransactionalMessageData(
            Recipients=ElasticEmail.TransactionalRecipient(To=[TO]),
            Content=ElasticEmail.EmailContent(
                From=FROM,
                Subject="Scheduled Email",
                Body=[
                    ElasticEmail.BodyPart(
                        ContentType="HTML",
                        Content="<h1>Scheduled Email</h1><p>This email was scheduled for {}.</p>".format(scheduled_iso),
                    ),
                ],
            ),
            Options=ElasticEmail.Options(TimeOffset=DELAY_MINUTES),
        )

        try:
            result = emails_api.emails_transactional_post(message)
            print("Email scheduled for", scheduled_iso)
            print("Transaction ID:", result.transaction_id)
            print("Message ID:", result.message_id)
        except ElasticEmail.ApiException as e:
            print_api_error("schedule email", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
