"""
Statistics Example

Account-wide sending statistics for the last 30 days.
The SDK takes datetime objects and serializes them as YYYY-MM-DDThh:mm:ss (UTC).

Usage: python examples/statistics.py
"""

import datetime
import os
import sys

import ElasticEmail

sys.path.insert(0, os.path.dirname(__file__))
from ee import get_configuration, print_api_error


def main():
    configuration = get_configuration()
    to_date = datetime.datetime.utcnow().replace(microsecond=0)
    from_date = to_date - datetime.timedelta(days=30)

    with ElasticEmail.ApiClient(configuration) as api_client:
        statistics_api = ElasticEmail.StatisticsApi(api_client)

        try:
            data = statistics_api.statistics_get(from_date, to=to_date)

            print("=== Statistics {} to {} ===".format(from_date.isoformat(), to_date.isoformat()))
            print("Recipients:   ", data.recipients)
            print("Emails total: ", data.email_total)
            print("Delivered:    ", data.delivered)
            print("Bounced:      ", data.bounced)
            print("In progress:  ", data.in_progress)
            print("Opened:       ", data.opened)
            print("Clicked:      ", data.clicked)
            print("Unsubscribed: ", data.unsubscribed)
            print("Complaints:   ", data.complaints)
        except ElasticEmail.ApiException as e:
            print_api_error("fetch statistics", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
