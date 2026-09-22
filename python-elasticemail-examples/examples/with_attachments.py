"""
Email with Attachment Example

Usage: python examples/with_attachments.py
"""

import base64
import datetime
import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import FROM, TO, get_configuration, print_api_error


def main():
    configuration = get_configuration()

    file_content = (
        "Sample Attachment\n"
        "==================\n\n"
        "This file was attached to your email.\n"
        "Sent at: {}\n".format(datetime.datetime.utcnow().isoformat())
    )
    encoded = base64.b64encode(file_content.encode()).decode()

    with ElasticEmail.ApiClient(configuration) as api_client:
        emails_api = ElasticEmail.EmailsApi(api_client)

        message = ElasticEmail.EmailTransactionalMessageData(
            Recipients=ElasticEmail.TransactionalRecipient(To=[TO]),
            Content=ElasticEmail.EmailContent(
                From=FROM,
                Subject="Email with Attachment",
                Body=[
                    ElasticEmail.BodyPart(
                        ContentType="HTML",
                        Content="<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>",
                    ),
                ],
                # BinaryContent is base64. Total message size limit applies (see account limits).
                Attachments=[
                    ElasticEmail.MessageAttachment(
                        BinaryContent=encoded,
                        Name="sample.txt",
                        ContentType="text/plain",
                    ),
                ],
            ),
        )

        try:
            result = emails_api.emails_transactional_post(message)
            print("Email with attachment sent successfully!")
            print("Transaction ID:", result.transaction_id)
            print("Message ID:", result.message_id)
        except ElasticEmail.ApiException as e:
            print_api_error("send email", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
