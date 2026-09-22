"""
Prevent Gmail Threading Example

Gmail groups emails into threads based on subject and Message-ID/References headers.
A unique X-Entity-Ref-ID header per email prevents this grouping.

Usage: python examples/prevent_threading.py
"""

import os
import sys
import uuid

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import FROM, TO, get_configuration, print_api_error


def main():
    configuration = get_configuration()

    with ElasticEmail.ApiClient(configuration) as api_client:
        emails_api = ElasticEmail.EmailsApi(api_client)

        for i in range(1, 4):
            message = ElasticEmail.EmailTransactionalMessageData(
                Recipients=ElasticEmail.TransactionalRecipient(To=[TO]),
                Content=ElasticEmail.EmailContent(
                    From=FROM,
                    Subject="Order Confirmation",  # same subject for all
                    Body=[
                        ElasticEmail.BodyPart(
                            ContentType="HTML",
                            Content="<h1>Order Confirmation</h1><p>This is email #{}. Each appears as a separate conversation in Gmail.</p>".format(i),
                        ),
                    ],
                    Headers={"X-Entity-Ref-ID": str(uuid.uuid4())},
                ),
            )

            try:
                result = emails_api.emails_transactional_post(message)
                print("Email #{} sent: {}".format(i, result.message_id))
            except ElasticEmail.ApiException as e:
                print_api_error("send email #{}".format(i), e)
                sys.exit(1)

    print("\nAll emails sent with unique X-Entity-Ref-ID headers.")


if __name__ == "__main__":
    main()
