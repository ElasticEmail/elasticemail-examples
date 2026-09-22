import hashlib
import hmac
import html
import json
import logging
import re
from urllib.parse import quote

import ElasticEmail
from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

logger = logging.getLogger(__name__)

configuration = ElasticEmail.Configuration()
configuration.api_key["apikey"] = settings.ELASTICEMAIL_API_KEY
api_client = ElasticEmail.ApiClient(configuration)
emails_api = ElasticEmail.EmailsApi(api_client)
contacts_api = ElasticEmail.ContactsApi(api_client)
lists_api = ElasticEmail.ListsApi(api_client)

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
    return hmac.compare_digest(str(token or ""), settings.ELASTICEMAIL_WEBHOOK_TOKEN)


def sign(value):
    return hmac.new(settings.ELASTICEMAIL_WEBHOOK_TOKEN.encode(), value.encode(), hashlib.sha256).hexdigest()


def api_error_message(e):
    try:
        return json.loads(e.body).get("Error", e.body)
    except (TypeError, ValueError):
        return e.body or str(e)


def api_error(e):
    return JsonResponse({"error": api_error_message(e)}, status=e.status or 500)


def json_body(request):
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return None


def event_params(request):
    """Elastic Email sends parameters in the query string (GET) or as form fields (POST)."""
    event = request.GET.dict()
    event.update(request.POST.dict())
    return event


def send_html(to, subject, html_body, reply_to=None, attachments=None):
    message = ElasticEmail.EmailTransactionalMessageData(
        Recipients=ElasticEmail.TransactionalRecipient(To=[to]),
        Content=ElasticEmail.EmailContent(
            From=settings.EMAIL_FROM,
            ReplyTo=reply_to,
            Subject=subject,
            Body=[ElasticEmail.BodyPart(ContentType="HTML", Content=html_body)],
            Attachments=attachments,
        ),
    )
    return emails_api.emails_transactional_post(message)


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@csrf_exempt
@require_POST
def send_email(request):
    body = json_body(request)
    if body is None:
        return JsonResponse({"error": "Invalid request body"}, status=400)

    to = body.get("to")
    subject = body.get("subject")
    message = body.get("message")

    if not all([to, subject, message]):
        return JsonResponse({"error": "Missing required fields: to, subject, message"}, status=400)

    try:
        result = send_html(to, subject, "<p>{}</p>".format(message))
        return JsonResponse({"success": True, "transactionId": result.transaction_id, "messageId": result.message_id})
    except ElasticEmail.ApiException as e:
        return api_error(e)


# Elastic Email event notifications. Parameters: transaction, messageid, to, from, subject,
# date, status, category, channel, target (clicked URL), IP, Useragent, Country, City.
# Elastic Email sends a GET to validate the URL when the webhook is saved.
@csrf_exempt
@require_http_methods(["GET", "POST"])
def webhook(request):
    if not token_ok(request.GET.get("token")):
        return JsonResponse({"error": "Invalid token"}, status=401)

    event = event_params(request)
    status = sanitize(event.get("status"))

    if not status:
        return JsonResponse({"ok": True})

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

    return JsonResponse({"received": True, "status": status})


# Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
# Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
# subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
@csrf_exempt
@require_POST
def inbound(request):
    if not token_ok(request.GET.get("token")):
        return JsonResponse({"error": "Invalid token"}, status=401)

    mail = request.POST
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
            settings.CONTACT_EMAIL,
            "Fwd: {}".format(mail.get("subject") or "(no subject)"),
            body_html,
            reply_to=mail.get("from_email"),
            attachments=[
                ElasticEmail.MessageAttachment(Name=a["name"], BinaryContent=a["content"])
                for a in attachments
                if a["content"]
            ],
        )
        return JsonResponse({"received": True, "forwardedMessageId": result.message_id})
    except ElasticEmail.ApiException as e:
        return api_error(e)


@csrf_exempt
@require_POST
def double_optin_subscribe(request):
    body = json_body(request)
    if body is None:
        return JsonResponse({"error": "Invalid request body"}, status=400)

    email = body.get("email")
    name = body.get("name") or ""

    if not email:
        return JsonResponse({"error": "Missing required field: email"}, status=400)

    confirm_url = "{}/double-optin/confirm?email={}&token={}".format(
        settings.PUBLIC_URL, quote(email, safe=""), sign(email)
    )
    greeting = "Welcome, {}!".format(name) if name else "Welcome!"

    try:
        # Stored as Transactional so it receives the confirmation but no campaigns yet
        contacts_api.contacts_post(
            [ElasticEmail.ContactPayload(Email=email, FirstName=name.split(" ")[0], Status="Transactional")]
        )
        result = send_html(
            email, "Confirm your subscription", CONFIRM_HTML.format(greeting=greeting, confirm_url=confirm_url)
        )
        return JsonResponse({"success": True, "message": "Confirmation email sent", "messageId": result.message_id})
    except ElasticEmail.ApiException as e:
        return api_error(e)


@require_GET
def double_optin_confirm(request):
    email = request.GET.get("email", "")
    token = request.GET.get("token", "")

    if not email or not hmac.compare_digest(sign(email), token):
        return JsonResponse({"error": "Invalid confirmation link"}, status=400)

    try:
        lists_api.lists_by_name_contacts_post(
            settings.ELASTICEMAIL_LIST_NAME, ElasticEmail.EmailsPayload(Emails=[email])
        )
        if settings.CONFIRM_REDIRECT_URL:
            return HttpResponseRedirect(settings.CONFIRM_REDIRECT_URL)
        return JsonResponse({"confirmed": True, "email": email, "list": settings.ELASTICEMAIL_LIST_NAME})
    except ElasticEmail.ApiException as e:
        return api_error(e)


# Click-tracking based confirmation: create a webhook for Clicked events pointing here.
@csrf_exempt
@require_http_methods(["GET", "POST"])
def double_optin_webhook(request):
    if not token_ok(request.GET.get("token")):
        return JsonResponse({"error": "Invalid token"}, status=401)

    event = event_params(request)
    if request.method == "GET" and not event.get("status"):
        return JsonResponse({"ok": True})

    if event.get("status") != "Clicked" or "/double-optin/confirm" not in str(event.get("target") or ""):
        return JsonResponse({"received": True, "status": sanitize(event.get("status")), "message": "Event ignored"})

    try:
        lists_api.lists_by_name_contacts_post(
            settings.ELASTICEMAIL_LIST_NAME, ElasticEmail.EmailsPayload(Emails=[event.get("to")])
        )
        return JsonResponse({"received": True, "confirmed": True, "email": sanitize(event.get("to"))})
    except ElasticEmail.ApiException as e:
        return api_error(e)
