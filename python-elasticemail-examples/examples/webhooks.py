"""
Webhook Management Example

The webhook is created with signing (EnableSigning) and POST + JSON delivery (PostJson).
Every request then carries an HMAC-SHA256 X-ElasticEmail-Signature that the handlers verify
with ELASTICEMAIL_WEBHOOK_SECRET (see flask_app.py). The signing secret is returned only when
the webhook is created or its secret is rotated. Webhooks created without signing are
protected with a ?token= in the URL instead (ELASTICEMAIL_WEBHOOK_TOKEN).

Usage: python examples/webhooks.py
"""

import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import PUBLIC_URL, get_configuration, print_api_error


def fail(step, e):
    print_api_error(step, e)
    sys.exit(1)


def main():
    configuration = get_configuration()
    webhook_url = "{}/webhook".format(PUBLIC_URL)

    with ElasticEmail.ApiClient(configuration) as api_client:
        webhook_api = ElasticEmail.WebhookApi(api_client)

        # 1. Create a signed webhook that POSTs JSON. Elastic Email sends a test request on save,
        #    so the URL must be reachable (use a tunnel such as ngrok for local development).
        #    The test arrives before your endpoint knows the secret; a 401/403 answer to it is
        #    accepted, so the create call still succeeds. Signed webhooks don't follow redirects.
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
                    EnableSigning=True,
                    DeliveryMethod=ElasticEmail.WebhookDeliveryMethod.POSTJSON,
                )
            )
            webhook_id = webhook.webhook_id
            print("Webhook created:", webhook_id, webhook.url)
            print("Signing secret:", webhook.signing_secret)
            print("Store it as ELASTICEMAIL_WEBHOOK_SECRET - it is shown only once.")
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

        # 3. Rotate the signing secret. The old secret stops working at once (no grace period).
        if webhook_id:
            try:
                rotated = webhook_api.webhook_by_publicid_secret_rotate_post(webhook_id)
                print("\nNew signing secret:", rotated.signing_secret)
                print("Update ELASTICEMAIL_WEBHOOK_SECRET - it is shown only once.")
            except ElasticEmail.ApiException as e:
                fail("rotate webhook secret", e)

        # 4. Delete the one we created (comment out to keep it)
        if webhook_id:
            try:
                webhook_api.webhook_by_publicid_delete(webhook_id)
                print("\nWebhook deleted:", webhook_id)
            except ElasticEmail.ApiException as e:
                fail("delete webhook", e)


if __name__ == "__main__":
    main()
