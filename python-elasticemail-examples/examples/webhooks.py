"""
Webhook Management Example

Elastic Email does not sign webhook requests. The examples append a shared secret
as a query parameter and the receiving handler checks it (see flask_app.py).

Usage: python examples/webhooks.py
"""

import os
import sys
from urllib.parse import quote

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import PUBLIC_URL, WEBHOOK_TOKEN, get_configuration, print_api_error


def fail(step, e):
    print_api_error(step, e)
    sys.exit(1)


def main():
    configuration = get_configuration()
    webhook_url = "{}/webhook?token={}".format(PUBLIC_URL, quote(WEBHOOK_TOKEN, safe=""))

    with ElasticEmail.ApiClient(configuration) as api_client:
        webhook_api = ElasticEmail.WebhookApi(api_client)

        # 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
        #    and answer 2xx (use a tunnel such as ngrok for local development).
        webhook_id = None
        try:
            webhook = webhook_api.webhook_post(
                ElasticEmail.WebhookCreatePayload(
                    Name="examples-webhook",
                    URL=webhook_url,
                    NotifyOncePerEmail=False,
                    NotificationForSent=True,
                    NotificationForOpened=True,
                    NotificationForClicked=True,
                    NotificationForUnsubscribed=True,
                    NotificationForAbuseReport=True,
                    NotificationForError=True,
                )
            )
            webhook_id = webhook.webhook_id
            print("Webhook created:", webhook_id, webhook.url)
        except ElasticEmail.ApiException as e:
            fail("create webhook", e)

        # 2. List
        try:
            webhooks = webhook_api.webhook_get(limit=50, offset=0)
            print("\nWebhooks ({}):".format(len(webhooks)))
            for w in webhooks:
                print(" - {} {} {} enabled={}".format(w.webhook_id, w.name, w.url, w.is_enabled))
        except ElasticEmail.ApiException as e:
            fail("list webhooks", e)

        # 3. Delete the one we created (comment out to keep it)
        if webhook_id:
            try:
                webhook_api.webhook_by_publicid_delete(webhook_id)
                print("\nWebhook deleted:", webhook_id)
            except ElasticEmail.ApiException as e:
                fail("delete webhook", e)


if __name__ == "__main__":
    main()
