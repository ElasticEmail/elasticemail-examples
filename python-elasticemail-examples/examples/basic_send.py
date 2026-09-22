"""
Basic Email Sending Example

Sends a single transactional email with HTML and plain text bodies.

Usage: python examples/basic_send.py
"""

import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import FROM, TO, get_configuration, print_api_error


def main():
    configuration = get_configuration()

    with ElasticEmail.ApiClient(configuration) as api_client:
        emails_api = ElasticEmail.EmailsApi(api_client)

        message = ElasticEmail.EmailTransactionalMessageData(
            Recipients=ElasticEmail.TransactionalRecipient(To=[TO]),
            Content=ElasticEmail.EmailContent(
                From=FROM,
                Subject="Hello from Elastic Email!",
                Body=[
                    ElasticEmail.BodyPart(
                        ContentType="HTML",
                        Content="<h1>Welcome!</h1><p>This email was sent using the Elastic Email Python SDK.</p>",
                    ),
                    ElasticEmail.BodyPart(
                        ContentType="PlainText",
                        Content="Welcome! This email was sent using the Elastic Email Python SDK.",
                    ),
                ],
            ),
        )

        try:
            result = emails_api.emails_transactional_post(message)
            print("Email sent successfully!")
            print("Transaction ID:", result.transaction_id)
            print("Message ID:", result.message_id)
        except ElasticEmail.ApiException as e:
            print_api_error("send email", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
