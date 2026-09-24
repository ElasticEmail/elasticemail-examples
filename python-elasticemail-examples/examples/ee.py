"""
Shared configuration for the Elastic Email examples.

Every script does `from ee import ...` after adding its own directory to sys.path,
so they can be run from the project root: python examples/basic_send.py
"""

import hashlib
import hmac
import math
import os
import sys
import threading
import time
from urllib.parse import urlparse

import ElasticEmail
from dotenv import load_dotenv

load_dotenv()

FROM = os.environ.get("EMAIL_FROM", "Acme <hello@yourdomain.com>")
TO = os.environ.get("EMAIL_TO", "you@yourdomain.com")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", FROM)
LIST_NAME = os.environ.get("ELASTICEMAIL_LIST_NAME", "Newsletter")
TEMPLATE_NAME = os.environ.get("ELASTICEMAIL_TEMPLATE_NAME", "welcome-example")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:3000")
WEBHOOK_TOKEN = os.environ.get("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
SENDING_DOMAIN = os.environ.get("SENDING_DOMAIN", "yourdomain.com")
CONFIRM_REDIRECT_URL = os.environ.get("CONFIRM_REDIRECT_URL", "")
# Required by POST /send. Callers send it as "Authorization: Bearer <token>".
SEND_TOKEN = os.environ.get("ELASTICEMAIL_SEND_TOKEN", "")
CONFIRM_LINK_TTL = 48 * 3600


def get_configuration():
    """Build an SDK Configuration from ELASTICEMAIL_API_KEY or exit with a clear message."""
    api_key = os.environ.get("ELASTICEMAIL_API_KEY")
    if not api_key:
        print(
            "ELASTICEMAIL_API_KEY is not set. Copy .env.example to .env and add your key "
            "from https://app.elasticemail.com/marketing/settings/new/manage-api",
            file=sys.stderr,
        )
        sys.exit(1)

    configuration = ElasticEmail.Configuration()
    configuration.api_key["apikey"] = api_key
    return configuration


def print_api_error(step, e):
    """Print status and body of an ElasticEmail.ApiException."""
    print("Error ({}): {} {}".format(step, e.status, e.body), file=sys.stderr)


def api_error_message(e):
    """Extract the Error string from an ApiException body, falling back to the raw body."""
    import json

    try:
        return json.loads(e.body).get("Error", e.body)
    except (TypeError, ValueError):
        return e.body or str(e)


# ---------------------------------------------------------------------------
# Security helpers shared by the server apps
# ---------------------------------------------------------------------------

_HTML_ESCAPES = str.maketrans(
    {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "{": "&#123;", "}": "&#125;"}
)


def escape_html(value):
    """Escape a user-supplied value for an HTML body.

    Elastic Email treats `{...}` and `{{...}}` in message content as template syntax,
    so braces are escaped as well.
    """
    return str(value if value is not None else "").translate(_HTML_ESCAPES)


def plain_text(value):
    """Strip braces from a user-supplied value for PlainText bodies and contact fields."""
    return str(value if value is not None else "").replace("{", "").replace("}", "")


def header_text(value):
    """plain_text() plus no CR/LF, for Subject and other header-like fields."""
    return plain_text(value).replace("\r", "").replace("\n", "")


def safe_equal(a, b):
    """Constant-time string comparison (bytes, so non-ASCII input cannot raise)."""
    return hmac.compare_digest(str(a or "").encode(), str(b or "").encode())


def email_shape_ok(email):
    """Reject anything with whitespace, CR/LF, or not exactly one @."""
    if not isinstance(email, str) or email.count("@") != 1:
        return False
    return not any(c.isspace() for c in email)


def _allowed_domains():
    domains = [d.strip().lower() for d in os.environ.get("EMAIL_ALLOWED_DOMAINS", "").split(",")]
    domains = [d for d in domains if d]
    if not domains:
        email_to = os.environ.get("EMAIL_TO", "")
        if "@" in email_to:
            default = email_to.rsplit("@", 1)[1].strip().lower()
            if default:
                domains = [default]
    return set(domains)


ALLOWED_DOMAINS = _allowed_domains()


def recipient_allowed(email):
    """True when the recipient's domain is in EMAIL_ALLOWED_DOMAINS (default: the domain of EMAIL_TO)."""
    if not email_shape_ok(email):
        return False
    return email.rsplit("@", 1)[1].lower() in ALLOWED_DOMAINS


def send_token_ok(authorization):
    """Authorization must be exactly "Bearer <ELASTICEMAIL_SEND_TOKEN>"."""
    header = str(authorization or "")
    if not header.startswith("Bearer "):
        return False
    return safe_equal(header[len("Bearer "):], SEND_TOKEN)


def sign_confirm(secret, email, expires):
    """HMAC-SHA256 of email + "\n" + expires, hex encoded."""
    return hmac.new(secret.encode(), "{}\n{}".format(email, expires).encode(), hashlib.sha256).hexdigest()


def confirm_url(public_url, secret, email):
    """Double opt-in confirmation link, valid for 48 hours."""
    from urllib.parse import quote

    expires = int(time.time()) + CONFIRM_LINK_TTL
    return "{}/double-optin/confirm?email={}&expires={}&token={}".format(
        public_url, quote(email, safe=""), expires, sign_confirm(secret, email, expires)
    )


def confirm_link_ok(secret, email, expires, token):
    """Check a confirmation link: all fields present, not expired, HMAC matches."""
    if not email or not expires or not token:
        return False
    expires = str(expires)
    if not (expires.isascii() and expires.isdigit()) or int(expires) < time.time():
        return False
    return safe_equal(sign_confirm(secret, email, expires), token)


class FixedWindowLimiter:
    """Fixed-window rate limiter.

    In-memory limits are per process; use a shared store (Redis, the platform's rate limiter)
    in production.
    """

    def __init__(self, limit, window_seconds):
        self.limit = limit
        self.window = window_seconds
        self.hits = {}
        self.lock = threading.Lock()

    def hit(self, key):
        """Count one request. Returns None when allowed, or seconds until the window resets."""
        now = time.time()
        with self.lock:
            if len(self.hits) > 10000:
                self.hits = {k: v for k, v in self.hits.items() if v[0] + self.window > now}
            start, count = self.hits.get(key, (now, 0))
            if start + self.window <= now:
                start, count = now, 0
            if count >= self.limit:
                return max(1, math.ceil(start + self.window - now))
            self.hits[key] = (start, count + 1)
            return None


# POST /double-optin/subscribe: per client IP 5 per 10 minutes, per email 3 per hour
SUBSCRIBE_IP_LIMIT = FixedWindowLimiter(5, 10 * 60)
SUBSCRIBE_EMAIL_LIMIT = FixedWindowLimiter(3, 60 * 60)


def subscribe_rate_limited(ip, email):
    """Returns None when allowed, or the Retry-After seconds."""
    return SUBSCRIBE_IP_LIMIT.hit(str(ip or "")) or SUBSCRIBE_EMAIL_LIMIT.hit(email.lower())


def check_startup(webhook_token=None, public_url=None, send_route=True):
    """Startup checks for the long-running servers."""
    if webhook_token is None:
        webhook_token = WEBHOOK_TOKEN
    if public_url is None:
        public_url = os.environ.get("PUBLIC_URL", "")
    if send_route and not SEND_TOKEN:
        print("POST /send is disabled until ELASTICEMAIL_SEND_TOKEN is set", file=sys.stderr)
    if webhook_token in ("", "change_me"):
        host = urlparse(public_url).hostname if public_url else None
        if not public_url or host in ("localhost", "127.0.0.1", "::1"):
            print("ELASTICEMAIL_WEBHOOK_TOKEN is the placeholder; fine for local testing only", file=sys.stderr)
        else:
            print(
                "Refusing to start: set ELASTICEMAIL_WEBHOOK_TOKEN before exposing webhooks at {}".format(public_url),
                file=sys.stderr,
            )
            sys.exit(1)
