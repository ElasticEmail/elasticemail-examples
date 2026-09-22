"""
Email with Inline (CID) Image Example

Elastic Email derives the Content-ID of an attachment from its file name.
Reference the attachment Name after "cid:" to embed it inline.

Usage: python examples/with_cid_attachments.py
"""

import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import FROM, TO, get_configuration, print_api_error

# Minimal 1x1 PNG placeholder (base64-encoded)
PLACEHOLDER_IMAGE = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

HTML = """<div style="font-family: Arial, sans-serif; padding: 20px;">
  <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
  <h1>Welcome!</h1>
  <p>This email contains an inline image referenced by Content-ID.</p>
</div>"""


def main():
    configuration = get_configuration()

    with ElasticEmail.ApiClient(configuration) as api_client:
        emails_api = ElasticEmail.EmailsApi(api_client)

        message = ElasticEmail.EmailTransactionalMessageData(
            Recipients=ElasticEmail.TransactionalRecipient(To=[TO]),
            Content=ElasticEmail.EmailContent(
                From=FROM,
                Subject="Email with Inline Image",
                Body=[ElasticEmail.BodyPart(ContentType="HTML", Content=HTML)],
                Attachments=[
                    ElasticEmail.MessageAttachment(
                        BinaryContent=PLACEHOLDER_IMAGE,
                        Name="logo.png",
                        ContentType="image/png",
                    ),
                ],
            ),
        )

        try:
            result = emails_api.emails_transactional_post(message)
            print("Email with inline image sent successfully!")
            print("Transaction ID:", result.transaction_id)
            print("Message ID:", result.message_id)
        except ElasticEmail.ApiException as e:
            print_api_error("send email", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
