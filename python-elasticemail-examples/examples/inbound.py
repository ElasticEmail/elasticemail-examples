"""
Inbound Route Management Example

Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
Matching emails are parsed and POSTed as form fields to HttpAddress
(from_email, subject, body_text, body_html, att1_name, att1_content, ...).
See flask_app.py for the receiving handler.

Usage: python examples/inbound.py
"""

import os
import sys
from urllib.parse import quote

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import PUBLIC_URL, SENDING_DOMAIN, WEBHOOK_TOKEN, get_configuration, print_api_error


def fail(step, e):
    print_api_error(step, e)
    sys.exit(1)


def main():
    configuration = get_configuration()

    with ElasticEmail.ApiClient(configuration) as api_client:
        inbound_api = ElasticEmail.InboundRouteApi(api_client)

        route_id = None
        try:
            route = inbound_api.inboundroute_post(
                ElasticEmail.InboundPayload(
                    Name="examples-inbound",
                    Filter="*@" + SENDING_DOMAIN,
                    FilterType="EmailAddress",
                    ActionType="NotifyViaHttp",
                    HttpAddress="{}/inbound?token={}".format(PUBLIC_URL, quote(WEBHOOK_TOKEN, safe="")),
                )
            )
            route_id = route.public_id
            print("Inbound route created:", route_id, route.filter, "->", route.action_parameter)
        except ElasticEmail.ApiException as e:
            fail("create route", e)

        try:
            routes = inbound_api.inboundroute_get()
            print("\nInbound routes ({}):".format(len(routes)))
            for r in routes:
                print(
                    " - [{}] {} {}: {}={} {} {}".format(
                        r.sort_order, r.public_id, r.name, r.filter_type, r.filter, r.action_type, r.action_parameter or ""
                    )
                )
        except ElasticEmail.ApiException as e:
            fail("list routes", e)

        # Delete the route we created (comment out to keep it)
        if route_id:
            try:
                inbound_api.inboundroute_by_id_delete(route_id)
                print("\nInbound route deleted:", route_id)
            except ElasticEmail.ApiException as e:
                fail("delete route", e)


if __name__ == "__main__":
    main()
