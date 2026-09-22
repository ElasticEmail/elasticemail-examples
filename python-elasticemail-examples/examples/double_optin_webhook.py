"""
Double Opt-In: Webhook Handler

Alternative confirmation flow driven by Elastic Email click tracking.
Create a webhook (see webhooks.py) pointing at POST /double-optin/webhook.
When the recipient clicks the confirm link, Elastic Email reports status=Clicked
with the clicked URL in "target". The contact is then added to the list.

Usage: python examples/double_optin_webhook.py
"""

import hmac
import os
import sys

import ElasticEmail
from flask import Flask, jsonify, request

sys.path.insert(0, os.path.dirname(__file__))
from ee import LIST_NAME, WEBHOOK_TOKEN, api_error_message, get_configuration, print_api_error

configuration = get_configuration()
app = Flask(__name__)


def token_ok(token):
    return hmac.compare_digest(str(token or ""), WEBHOOK_TOKEN)


def sanitize(value):
    return str(value if value is not None else "").replace("\r", "").replace("\n", "")


def event_params():
    """Elastic Email sends parameters in the query string (GET) or as form fields (POST)."""
    event = dict(request.args)
    event.update(request.form)
    return event


# Elastic Email validates the URL with a GET when the webhook is saved.
@app.route("/double-optin/webhook", methods=["GET"])
def validate():
    if not token_ok(request.args.get("token")):
        return jsonify({"error": "Invalid token"}), 401
    return jsonify({"ok": True})


@app.route("/double-optin/webhook", methods=["POST"])
def double_optin_webhook():
    if not token_ok(request.args.get("token")):
        return jsonify({"error": "Invalid token"}), 401

    event = event_params()
    status = sanitize(event.get("status"))
    target = sanitize(event.get("target"))
    recipient = sanitize(event.get("to"))

    if status != "Clicked" or "/double-optin/confirm" not in target:
        return jsonify({"received": True, "status": status, "message": "Event ignored"})

    with ElasticEmail.ApiClient(configuration) as api_client:
        lists_api = ElasticEmail.ListsApi(api_client)
        try:
            lists_api.lists_by_name_contacts_post(LIST_NAME, ElasticEmail.EmailsPayload(Emails=[recipient]))
            print("Subscription confirmed via click:", recipient)
            return jsonify({"received": True, "confirmed": True, "email": recipient, "list": LIST_NAME})
        except ElasticEmail.ApiException as e:
            print_api_error("add contact to list", e)
            return jsonify({"error": api_error_message(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    print("Double opt-in webhook listening on http://localhost:{}/double-optin/webhook".format(port))
    app.run(port=port)
