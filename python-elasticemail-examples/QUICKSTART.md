# Send your first email with Python

Five minutes from a clean clone to a delivered email, using the Elastic Email Python SDK. Works
plain, with Flask, FastAPI or Django.

## Prerequisites

- Python 3.9+
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/python-elasticemail-examples

python -m venv venv && source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

In a project of your own:

```bash
pip install ElasticEmail python-dotenv
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

Full list in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

```python
import os
import ElasticEmail
from dotenv import load_dotenv

load_dotenv()

configuration = ElasticEmail.Configuration()
configuration.api_key["apikey"] = os.environ["ELASTICEMAIL_API_KEY"]

with ElasticEmail.ApiClient(configuration) as api_client:
    emails_api = ElasticEmail.EmailsApi(api_client)

    result = emails_api.emails_transactional_post(
        ElasticEmail.EmailTransactionalMessageData(
            Recipients=ElasticEmail.TransactionalRecipient(To=[os.environ["EMAIL_TO"]]),
            Content=ElasticEmail.EmailContent(
                From=os.environ["EMAIL_FROM"],
                Subject="Hello from Elastic Email!",
                Body=[
                    ElasticEmail.BodyPart(ContentType="HTML", Content="<h1>Welcome!</h1>"),
                    ElasticEmail.BodyPart(ContentType="PlainText", Content="Welcome!"),
                ],
            ),
        )
    )

    print("Transaction ID:", result.transaction_id)
```

Two casings in one snippet, and that is not a typo: model **constructors** take PascalCase keyword
arguments (`ContentType=`, `From=`), while **responses** expose snake_case attributes
(`result.transaction_id`).

Run the version in this repository:

```bash
python examples/basic_send.py
```

`examples/ee.py` holds the shared setup - `get_configuration()`, `FROM`, `TO` and
`print_api_error()`.

## 6. Or run a web app

```bash
python examples/flask_app.py            # Flask,   http://localhost:3000
python examples/fastapi_app.py          # FastAPI, http://localhost:3000
cd django_app && python manage.py runserver 8001    # Django
```

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Python!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

All three expose the same routes with the same JSON shapes.

## Handling failures

```python
try:
    result = emails_api.emails_transactional_post(message)
except ElasticEmail.ApiException as e:
    print(e.status, e.body)     # body is {"Error": "..."}
```

See [Error handling](../docs/error-handling.md).

## Next steps

```bash
python examples/batch_send.py            # one call, personalized per recipient
python examples/with_attachments.py      # base64 file attachment
python examples/with_cid_attachments.py  # inline image via cid:
python examples/with_template.py         # hosted template + merge values
python examples/webhooks.py              # create, list, delete a webhook
```

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every script and route | [README.md](README.md) |
