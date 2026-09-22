"""
FastAPI Application with Elastic Email

Usage:
    python examples/fastapi_app.py
    # or: uvicorn examples.fastapi_app:app --reload --port 3000

Endpoints:
    GET  /health
    POST /send                     {"to", "subject", "message"}
    GET|POST /webhook?token=...    Elastic Email event notifications
    POST /inbound?token=...        inbound email pushed by an inbound route
    POST /double-optin/subscribe   {"email", "name"}
    GET  /double-optin/confirm?email=&token=
    POST /double-optin/webhook?token=...
    GET  /docs                     OpenAPI docs
"""

import hashlib
import hmac
import html
import logging
import os
import re
import sys
from typing import Optional
from urllib.parse import parse_qs, quote

import ElasticEmail
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(__file__))
from ee import (
    CONFIRM_REDIRECT_URL,
    CONTACT_EMAIL,
    FROM,
    LIST_NAME,
    PUBLIC_URL,
    WEBHOOK_TOKEN,
    api_error_message,
    get_configuration,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

configuration = get_configuration()
api_client = ElasticEmail.ApiClient(configuration)
emails_api = ElasticEmail.EmailsApi(api_client)
contacts_api = ElasticEmail.ContactsApi(api_client)
lists_api = ElasticEmail.ListsApi(api_client)

app = FastAPI(title="Elastic Email FastAPI Examples")


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    missing = [str(err["loc"][-1]) for err in exc.errors() if err.get("type") == "missing"]
    if missing:
        return JSONResponse({"error": "Missing required fields: " + ", ".join(missing)}, status_code=400)
    return JSONResponse({"error": "Invalid request body"}, status_code=400)

CONFIRM_HTML = """<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>{greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="{confirm_url}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>"""


class EmailRequest(BaseModel):
    to: str
    subject: str
    message: str


class SubscribeRequest(BaseModel):
    email: str
    name: Optional[str] = None


def sanitize(value):
    return str(value if value is not None else "").replace("\r", "").replace("\n", "")


def token_ok(token):
    return hmac.compare_digest(str(token or ""), WEBHOOK_TOKEN)


def sign(value):
    return hmac.new(WEBHOOK_TOKEN.encode(), value.encode(), hashlib.sha256).hexdigest()


def api_error(e):
    return JSONResponse({"error": api_error_message(e)}, status_code=e.status or 500)


def unauthorized():
    return JSONResponse({"error": "Invalid token"}, status_code=401)


async def event_params(request):
    """Merge query string and form-encoded body. Parsed by hand so python-multipart is not needed."""
    event = dict(request.query_params)
    body = await request.body()
    if body:
        for key, values in parse_qs(body.decode("utf-8", errors="replace"), keep_blank_values=True).items():
            event[key] = values[-1]
    return event


def send_html(to, subject, html_body, reply_to=None, attachments=None):
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
    return emails_api.emails_transactional_post(message)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/send")
async def send_email(email_request: EmailRequest):
    try:
        result = send_html(email_request.to, email_request.subject, "<p>{}</p>".format(email_request.message))
        return {"success": True, "transactionId": result.transaction_id, "messageId": result.message_id}
    except ElasticEmail.ApiException as e:
        return api_error(e)


# Elastic Email event notifications. Parameters: transaction, messageid, to, from, subject,
# date, status, category, channel, target (clicked URL), IP, Useragent, Country, City.
# Elastic Email sends a GET to validate the URL when the webhook is saved.
@app.api_route("/webhook", methods=["GET", "POST"])
async def webhook(request: Request):
    if not token_ok(request.query_params.get("token")):
        return unauthorized()

    event = await event_params(request)
    status = sanitize(event.get("status"))

    if not status:
        return {"ok": True}

    logger.info("Webhook event: %s to: %s transaction: %s", status, sanitize(event.get("to")), sanitize(event.get("transaction")))

    if status == "Sent":
        logger.info("Email sent, message id: %s", sanitize(event.get("messageid")))
    elif status == "Opened":
        logger.info("Email opened from %s %s", sanitize(event.get("Country")), sanitize(event.get("City")))
    elif status == "Clicked":
        logger.info("Link clicked: %s", sanitize(event.get("target")))
    elif status == "Error":
        logger.info("Bounce/error, category: %s", sanitize(event.get("category")))
    elif status == "AbuseReport":
        logger.info("Complaint received")
    elif status == "Unsubscribed":
        logger.info("Recipient unsubscribed")

    return {"received": True, "status": status}


# Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
# Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
# subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
@app.post("/inbound")
async def inbound(request: Request):
    if not token_ok(request.query_params.get("token")):
        return unauthorized()

    mail = await event_params(request)
    attachments = [
        {"name": mail[key], "content": mail.get(key.replace("_name", "_content"))}
        for key in mail
        if re.match(r"^att\d+_name$", key)
    ]

    logger.info("Inbound email from: %s subject: %s", sanitize(mail.get("from_email")), sanitize(mail.get("subject")))
    logger.info("Attachments: %s", ", ".join(a["name"] for a in attachments) or "none")

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
        return {"received": True, "forwardedMessageId": result.message_id}
    except ElasticEmail.ApiException as e:
        return api_error(e)


@app.post("/double-optin/subscribe")
async def double_optin_subscribe(subscribe_request: SubscribeRequest):
    email = subscribe_request.email
    name = subscribe_request.name or ""

    confirm_url = "{}/double-optin/confirm?email={}&token={}".format(PUBLIC_URL, quote(email, safe=""), sign(email))
    greeting = "Welcome, {}!".format(name) if name else "Welcome!"

    try:
        contacts_api.contacts_post(
            [ElasticEmail.ContactPayload(Email=email, FirstName=name.split(" ")[0], Status="Transactional")]
        )
        result = send_html(
            email, "Confirm your subscription", CONFIRM_HTML.format(greeting=greeting, confirm_url=confirm_url)
        )
        return {"success": True, "message": "Confirmation email sent", "messageId": result.message_id}
    except ElasticEmail.ApiException as e:
        return api_error(e)


@app.get("/double-optin/confirm")
async def double_optin_confirm(email: str = "", token: str = ""):
    if not email or not hmac.compare_digest(sign(email), token):
        return JSONResponse({"error": "Invalid confirmation link"}, status_code=400)

    try:
        lists_api.lists_by_name_contacts_post(LIST_NAME, ElasticEmail.EmailsPayload(Emails=[email]))
        if CONFIRM_REDIRECT_URL:
            return RedirectResponse(CONFIRM_REDIRECT_URL)
        return {"confirmed": True, "email": email, "list": LIST_NAME}
    except ElasticEmail.ApiException as e:
        return api_error(e)


# Click-tracking based confirmation: create a webhook for Clicked events pointing here.
@app.api_route("/double-optin/webhook", methods=["GET", "POST"])
async def double_optin_webhook(request: Request):
    if not token_ok(request.query_params.get("token")):
        return unauthorized()

    event = await event_params(request)
    if request.method == "GET" and not event.get("status"):
        return {"ok": True}

    if event.get("status") != "Clicked" or "/double-optin/confirm" not in str(event.get("target") or ""):
        return {"received": True, "status": sanitize(event.get("status")), "message": "Event ignored"}

    try:
        lists_api.lists_by_name_contacts_post(LIST_NAME, ElasticEmail.EmailsPayload(Emails=[event.get("to")]))
        return {"received": True, "confirmed": True, "email": sanitize(event.get("to"))}
    except ElasticEmail.ApiException as e:
        return api_error(e)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "3000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
