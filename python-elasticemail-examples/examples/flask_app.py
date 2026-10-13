"""
Flask Application with Elastic Email

Usage:
    python examples/flask_app.py

Endpoints:
    GET  /health
    POST /send                     {"to", "subject", "message"}
    GET|POST /webhook              Elastic Email event notifications (signed, or ?token=...)
    POST /inbound?token=...        inbound email pushed by an inbound route
    POST /double-optin/subscribe   {"email", "name"}
    GET  /double-optin/confirm?email=&token=
    GET|POST /double-optin/webhook (signed, or ?token=...)
"""

import hashlib
import hmac
import html
import os
import re
import sys
import uuid
from urllib.parse import quote

import ElasticEmail
from flask import Flask, jsonify, redirect, request

sys.path.insert(0, os.path.dirname(__file__))
from ee import (
    CONFIRM_REDIRECT_URL,
    CONTACT_EMAIL,
    FROM,
    LIST_NAME,
    PUBLIC_URL,
    WEBHOOK_SECRET,
    WEBHOOK_TOKEN,
    api_error_message,
    get_configuration,
    lower_keys,
    signed_event,
    verify_signature,
    wsgi_request_target,
)

configuration = get_configuration()
api_client = ElasticEmail.ApiClient(configuration)
emails_api = ElasticEmail.EmailsApi(api_client)
contacts_api = ElasticEmail.ContactsApi(api_client)
lists_api = ElasticEmail.ListsApi(api_client)

app = Flask(__name__)
# Inbound notifications carry base64 attachments in the form body
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

CONFIRM_HTML = """<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>{greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="{confirm_url}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>"""


def sanitize(value):
    """Strip newlines from user-controlled values before logging."""
    return str(value if value is not None else "").replace("\r", "").replace("\n", "")


def token_ok(token):
    """Constant-time comparison of the shared secret carried in ?token=."""
    return hmac.compare_digest(str(token or ""), WEBHOOK_TOKEN)


def sign(value):
    return hmac.new(WEBHOOK_TOKEN.encode(), value.encode(), hashlib.sha256).hexdigest()


def api_error(e):
    return jsonify({"error": api_error_message(e)}), e.status or 500


def event_params():
    """Elastic Email sends parameters in the query string (GET) or as form fields (POST)."""
    event = dict(request.args)
    event.update(request.form)
    return event


def webhook_event():
    """Authenticate an Elastic Email notification and return (event, error_response).

    With ELASTICEMAIL_WEBHOOK_SECRET set, the request must carry a valid signature and the event
    is read from the JSON body (POST) or the query string (GET). Without it, the ?token= check
    for unsigned webhooks applies.
    """
    if WEBHOOK_SECRET:
        body = request.get_data()  # raw body, read before any parsing
        if not verify_signature(
            WEBHOOK_SECRET,
            request.headers.get("X-ElasticEmail-Timestamp"),
            request.headers.get("X-ElasticEmail-Signature"),
            request.method,
            wsgi_request_target(request.environ),
            body,
        ):
            return None, (jsonify({"error": "Invalid signature"}), 401)
        event = signed_event(request.method, body, request.args)
        if event is None:
            return None, (jsonify({"error": "Invalid JSON body"}), 400)
        return event, None
    if not token_ok(request.args.get("token")):
        return None, (jsonify({"error": "Invalid token"}), 401)
    return lower_keys(event_params()), None


def send_html(to, subject, html_body, reply_to=None, attachments=None, idempotency_key=None):
    message = ElasticEmail.EmailTransactionalMessageData(
        Recipients=ElasticEmail.TransactionalRecipient(To=[to]),
        Content=ElasticEmail.EmailContent(
            From=FROM,
            ReplyTo=reply_to,
            Subject=subject,
            Body=[ElasticEmail.BodyPart(ContentType="HTML", Content=html_body)],
            Attachments=attachments,
        ),
    )
    return emails_api.emails_transactional_post(message, idempotency_key=idempotency_key)


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/send", methods=["POST"])
def send_email():
    data = request.get_json(silent=True) or {}
    to = data.get("to")
    subject = data.get("subject")
    message = data.get("message")

    if not all([to, subject, message]):
        return jsonify({"error": "Missing required fields: to, subject, message"}), 400

    # Forward the client's Idempotency-Key so its retries can't send twice; otherwise use a new one.
    idempotency_key = request.headers.get("Idempotency-Key") or str(uuid.uuid4())

    try:
        result = send_html(to, subject, "<p>{}</p>".format(message), idempotency_key=idempotency_key)
        return jsonify({"success": True, "transactionId": result.transaction_id, "messageId": result.message_id})
    except ElasticEmail.ApiException as e:
        return api_error(e)


# Elastic Email event notifications. Fields: transaction, messageid, to, from, subject,
# date, status, category, channel, target (clicked URL), ip, useragent, country, city.
# Signed PostJson webhooks send them as a JSON body, Get webhooks in the query string.
# Elastic Email sends a test request when the webhook is saved.
@app.route("/webhook", methods=["GET", "POST"])
def webhook():
    event, error = webhook_event()
    if error:
        return error

    status = sanitize(event.get("status"))

    if not status:
        # Validation ping or empty request
        return jsonify({"ok": True})

    print("Webhook event:", status, "to:", sanitize(event.get("to")), "transaction:", sanitize(event.get("transaction")))

    if status == "Sent":
        print("Email sent, message id:", sanitize(event.get("messageid")))
    elif status == "Opened":
        print("Email opened from", sanitize(event.get("country")), sanitize(event.get("city")))
    elif status == "Clicked":
        print("Link clicked:", sanitize(event.get("target")))
    elif status == "Error":
        print("Bounce/error, category:", sanitize(event.get("category")))
    elif status == "AbuseReport":
        print("Complaint received")
    elif status == "Unsubscribed":
        print("Recipient unsubscribed")

    return jsonify({"received": True, "status": status})


# Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
# Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
# subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
@app.route("/inbound", methods=["POST"])
def inbound():
    if not token_ok(request.args.get("token")):
        return jsonify({"error": "Invalid token"}), 401

    mail = request.form
    attachments = [
        {"name": mail[key], "content": mail.get(key.replace("_name", "_content"))}
        for key in mail
        if re.match(r"^att\d+_name$", key)
    ]

    print("Inbound email from:", sanitize(mail.get("from_email")), "subject:", sanitize(mail.get("subject")))
    print("Attachments:", ", ".join(a["name"] for a in attachments) or "none")

    # Forward a copy to the team inbox
    body_html = mail.get("body_html") or "<pre>{}</pre>".format(html.escape(mail.get("body_text", ""), quote=False))
    try:
        result = send_html(
            CONTACT_EMAIL,
            "Fwd: {}".format(mail.get("subject") or "(no subject)"),
            body_html,
            reply_to=mail.get("from_email"),
            attachments=[
                ElasticEmail.MessageAttachment(Name=a["name"], BinaryContent=a["content"])
                for a in attachments
                if a["content"]
            ],
        )
        return jsonify({"received": True, "forwardedMessageId": result.message_id})
    except ElasticEmail.ApiException as e:
        return api_error(e)


@app.route("/double-optin/subscribe", methods=["POST"])
def double_optin_subscribe():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    name = data.get("name") or ""

    if not email:
        return jsonify({"error": "Missing required field: email"}), 400

    confirm_url = "{}/double-optin/confirm?email={}&token={}".format(PUBLIC_URL, quote(email, safe=""), sign(email))
    greeting = "Welcome, {}!".format(name) if name else "Welcome!"

    try:
        # Stored as Transactional so it receives the confirmation but no campaigns yet
        contacts_api.contacts_post(
            [ElasticEmail.ContactPayload(Email=email, FirstName=name.split(" ")[0], Status="Transactional")]
        )
        result = send_html(
            email, "Confirm your subscription", CONFIRM_HTML.format(greeting=greeting, confirm_url=confirm_url)
        )
        return jsonify({"success": True, "message": "Confirmation email sent", "messageId": result.message_id})
    except ElasticEmail.ApiException as e:
        return api_error(e)


@app.route("/double-optin/confirm")
def double_optin_confirm():
    email = request.args.get("email", "")
    token = request.args.get("token", "")

    if not email or not hmac.compare_digest(sign(email), token):
        return jsonify({"error": "Invalid confirmation link"}), 400

    try:
        lists_api.lists_by_name_contacts_post(LIST_NAME, ElasticEmail.EmailsPayload(Emails=[email]))
        if CONFIRM_REDIRECT_URL:
            return redirect(CONFIRM_REDIRECT_URL)
        return jsonify({"confirmed": True, "email": email, "list": LIST_NAME})
    except ElasticEmail.ApiException as e:
        return api_error(e)


# Click-tracking based confirmation: create a webhook for Clicked events pointing here.
@app.route("/double-optin/webhook", methods=["GET", "POST"])
def double_optin_webhook():
    event, error = webhook_event()
    if error:
        return error

    if not event.get("status"):
        return jsonify({"ok": True})

    if event.get("status") != "Clicked" or "/double-optin/confirm" not in str(event.get("target") or ""):
        return jsonify({"received": True, "status": sanitize(event.get("status")), "message": "Event ignored"})

    try:
        lists_api.lists_by_name_contacts_post(LIST_NAME, ElasticEmail.EmailsPayload(Emails=[event.get("to")]))
        return jsonify({"received": True, "confirmed": True, "email": sanitize(event.get("to"))})
    except ElasticEmail.ApiException as e:
        return api_error(e)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print("Flask server running on http://localhost:{}".format(port))
    app.run(debug=debug, port=port)
