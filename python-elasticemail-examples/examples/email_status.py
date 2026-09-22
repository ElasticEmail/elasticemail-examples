"""
Email Status Example

Both ids are returned by every send call.

Usage: python examples/email_status.py <transactionId> [messageId]
"""

import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import get_configuration, print_api_error


def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: python examples/email_status.py <transactionId> [messageId]", file=sys.stderr)
        sys.exit(1)

    transaction_id = args[0]
    message_id = args[1] if len(args) > 1 else None

    configuration = get_configuration()

    with ElasticEmail.ApiClient(configuration) as api_client:
        emails_api = ElasticEmail.EmailsApi(api_client)

        try:
            status = emails_api.emails_by_transactionid_status_get(
                transaction_id,
                show_failed=True,
                show_sent=True,
                show_delivered=True,
                show_pending=True,
                show_opened=True,
                show_clicked=True,
            )
            print("=== Transaction status ===")
            print("Status:     ", status.status)
            print("Recipients: ", status.recipients_count)
            print("Sent:       ", status.sent_count, status.sent or [])
            print("Delivered:  ", status.delivered_count, status.delivered or [])
            print("Pending:    ", status.pending_count)
            print("Opened:     ", status.opened_count)
            print("Clicked:    ", status.clicked_count)
            print("Failed:     ", status.failed_count, status.failed or [])
        except ElasticEmail.ApiException as e:
            print_api_error("fetch status", e)
            sys.exit(1)

        if message_id:
            try:
                data = emails_api.emails_by_msgid_view_get(message_id)
                preview = data.preview
                message_status = data.status
                print("\n=== Message ===")
                print("From:    ", preview.var_from if preview else None)
                print("Subject: ", preview.subject if preview else None)
                if message_status:
                    print("Status:  ", message_status.status_name, message_status.date_sent or "")
                body = (preview.body if preview else None) or ""
                print("Body preview:", body[:200] + "..." if len(body) > 200 else body)
            except ElasticEmail.ApiException as e:
                print_api_error("fetch message", e)


if __name__ == "__main__":
    main()
