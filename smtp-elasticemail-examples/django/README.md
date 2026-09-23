# Send Email from Django with SMTP - Elastic Email

Use Django's built-in SMTP email backend with the
[Elastic Email](https://elasticemail.com/email-api) SMTP relay. You set a handful of `EMAIL_*`
settings read from the environment, and `send_mail()`, `EmailMultiAlternatives`, password reset
emails and admin error reports all go through Elastic Email.

> Part of the [Elastic Email SMTP examples](../README.md). New to SMTP with Elastic Email? Start with the [SMTP quickstart](../QUICKSTART.md).
> Need templates, contacts or webhooks from code? The [Python examples](../../python-elasticemail-examples/) include a Django app that uses the REST API SDK.

## Prerequisites

- Django 4.2+ (Python 3.9+)
- An Elastic Email account with a verified sender domain ([How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain))
- SMTP credentials from Settings > SMTP in the Elastic Email dashboard ([SMTP settings](https://help.elasticemail.com/en/articles/4803409-smtp-settings))

## Configure

```bash
pip install python-dotenv
cp ../.env.example .env   # then fill in the SMTP username, password, EMAIL_FROM and EMAIL_TO
```

```python
# settings.py
import os
from dotenv import load_dotenv

load_dotenv()

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ.get("ELASTICEMAIL_SMTP_HOST", "smtp.elasticemail.com")
EMAIL_PORT = int(os.environ.get("ELASTICEMAIL_SMTP_PORT", "2525"))
EMAIL_USE_TLS = True   # STARTTLS on 2525/587. For 465 use EMAIL_USE_SSL = True instead.
EMAIL_HOST_USER = os.environ["ELASTICEMAIL_SMTP_USERNAME"]
EMAIL_HOST_PASSWORD = os.environ["ELASTICEMAIL_SMTP_PASSWORD"]
EMAIL_TIMEOUT = 30

DEFAULT_FROM_EMAIL = os.environ["EMAIL_FROM"]   # e.g. "Acme <hello@yourdomain.com>"
SERVER_EMAIL = DEFAULT_FROM_EMAIL              # sender for admin error emails
```

`EMAIL_USE_TLS` and `EMAIL_USE_SSL` are mutually exclusive. Setting both raises an error.

## Send a test

```bash
python manage.py sendtestemail you@yourdomain.com
```

## Send HTML and text

```python
import os
from django.core.mail import EmailMultiAlternatives

msg = EmailMultiAlternatives(
    subject="Hello from Django",
    body="It works. This message went through Elastic Email SMTP.",
    to=[os.environ["EMAIL_TO"]],
)
msg.attach_alternative(
    "<p>It works. This message went through <strong>Elastic Email SMTP</strong>.</p>",
    "text/html",
)
msg.send()
```

With no `from_email`, Django uses `DEFAULT_FROM_EMAIL`. Or use the shortcut:
`send_mail(subject, text, None, [to], html_message=html)`.

## Notes

- Every sender, including `DEFAULT_FROM_EMAIL`, `SERVER_EMAIL` and any `from_email` you pass,
  must be on your verified domain.
- `send_mail()` blocks the request while the SMTP conversation runs. Send from a task queue
  (Celery, RQ, Django-Q) in views that users wait on.
- To send many messages over one connection, open it with `get_connection()` and pass it to
  `send_messages()`.
- In development, set `EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"` to print
  mail instead of sending it.

## AI assistant prompt

```
Configure Django to send email through the Elastic Email SMTP relay with the built-in
django.core.mail.backends.smtp.EmailBackend. In settings.py read from the environment (python-dotenv):
EMAIL_HOST=smtp.elasticemail.com, EMAIL_PORT=2525, EMAIL_USE_TLS=True (EMAIL_USE_SSL only for 465,
never both), EMAIL_HOST_USER and EMAIL_HOST_PASSWORD from ELASTICEMAIL_SMTP_USERNAME and
ELASTICEMAIL_SMTP_PASSWORD (the SMTP password from Elastic Email Settings > SMTP, not an API key),
and DEFAULT_FROM_EMAIL / SERVER_EMAIL from EMAIL_FROM, a sender on a domain verified in Elastic
Email. Send with EmailMultiAlternatives, setting a text body and attaching an text/html alternative.
```

## Resources

- [Elastic Email email API](https://elasticemail.com/email-api) - REST API and SMTP relay overview, features and plans
- [Django: Sending email](https://docs.djangoproject.com/en/stable/topics/email/)
- [Django: Email settings](https://docs.djangoproject.com/en/stable/ref/settings/#email-backend)
- [All SMTP integrations](../README.md)

## License

MIT
