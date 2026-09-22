import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Shared .env at the python-elasticemail-examples root
load_dotenv(BASE_DIR.parent / ".env")

SECRET_KEY = "django-insecure-example-key-change-in-production"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "elasticemail_app",
]

MIDDLEWARE = [
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "django_project.urls"
WSGI_APPLICATION = "django_project.wsgi.application"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Inbound notifications carry base64 attachments in the form body
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024

# Elastic Email configuration
ELASTICEMAIL_API_KEY = os.environ.get("ELASTICEMAIL_API_KEY", "")
if not ELASTICEMAIL_API_KEY:
    print(
        "ELASTICEMAIL_API_KEY is not set. Copy .env.example to .env in the python-elasticemail-examples "
        "folder and add your key from https://app.elasticemail.com/marketing/settings/new/manage-api",
        file=sys.stderr,
    )
    sys.exit(1)

EMAIL_FROM = os.environ.get("EMAIL_FROM", "Acme <hello@yourdomain.com>")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", EMAIL_FROM)
ELASTICEMAIL_LIST_NAME = os.environ.get("ELASTICEMAIL_LIST_NAME", "Newsletter")
ELASTICEMAIL_WEBHOOK_TOKEN = os.environ.get("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:3000")
CONFIRM_REDIRECT_URL = os.environ.get("CONFIRM_REDIRECT_URL", "")
