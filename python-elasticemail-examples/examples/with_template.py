"""
Template Example

Templates are referenced by name. The template is created on first run,
then a transactional email is sent with merge values.

Usage: python examples/with_template.py
"""

import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import FROM, TEMPLATE_NAME, TO, get_configuration, print_api_error


def ensure_template(templates_api):
    try:
        templates_api.templates_by_name_get(TEMPLATE_NAME)
        print('Template "{}" already exists.'.format(TEMPLATE_NAME))
        return
    except ElasticEmail.ApiException as e:
        if e.status != 404:
            raise

    templates_api.templates_post(
        ElasticEmail.TemplatePayload(
            Name=TEMPLATE_NAME,
            Subject="Welcome, {firstname}!",
            Body=[
                ElasticEmail.BodyPart(
                    ContentType="HTML",
                    Content="<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>",
                ),
            ],
            TemplateScope="Personal",
        )
    )
    print('Template "{}" created.'.format(TEMPLATE_NAME))


def main():
    configuration = get_configuration()

    with ElasticEmail.ApiClient(configuration) as api_client:
        emails_api = ElasticEmail.EmailsApi(api_client)
        templates_api = ElasticEmail.TemplatesApi(api_client)

        try:
            ensure_template(templates_api)

            # Merge values replace {placeholders} in the template subject and body.
            message = ElasticEmail.EmailTransactionalMessageData(
                Recipients=ElasticEmail.TransactionalRecipient(To=[TO]),
                Content=ElasticEmail.EmailContent(
                    From=FROM,
                    TemplateName=TEMPLATE_NAME,
                    Merge={"firstname": "Ann", "company": "Acme"},
                ),
            )
            result = emails_api.emails_transactional_post(message)
            print("Template email sent successfully!")
            print("Transaction ID:", result.transaction_id)
            print("Message ID:", result.message_id)
        except ElasticEmail.ApiException as e:
            print_api_error("template send", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
