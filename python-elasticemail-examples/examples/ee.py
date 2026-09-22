"""
Shared configuration for the Elastic Email examples.

Every script does `from ee import ...` after adding its own directory to sys.path,
so they can be run from the project root: python examples/basic_send.py
"""

import os
import sys

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
