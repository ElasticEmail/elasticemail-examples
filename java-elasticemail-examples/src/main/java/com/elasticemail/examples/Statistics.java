package com.elasticemail.examples;

import com.elasticemail.api.StatisticsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.LogStatusSummary;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

public class Statistics {
    public static void main(String[] args) {
        StatisticsApi statisticsApi = new StatisticsApi(Ee.client());

        // Account-wide sending statistics for the last 30 days.
        // The SDK serializes OffsetDateTime as ISO 8601; use UTC so the range matches the dashboard.
        OffsetDateTime to = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.SECONDS);
        OffsetDateTime from = to.minusDays(30);

        try {
            LogStatusSummary s = statisticsApi.statisticsGet(from, to);

            System.out.println("=== Statistics " + from + " to " + to + " ===");
            System.out.println("Recipients:    " + s.getRecipients());
            System.out.println("Emails total:  " + s.getEmailTotal());
            System.out.println("Delivered:     " + s.getDelivered());
            System.out.println("Bounced:       " + s.getBounced());
            System.out.println("In progress:   " + s.getInProgress());
            System.out.println("Opened:        " + s.getOpened());
            System.out.println("Clicked:       " + s.getClicked());
            System.out.println("Unsubscribed:  " + s.getUnsubscribed());
            System.out.println("Complaints:    " + s.getComplaints());
        } catch (ApiException e) {
            Ee.printApiError("fetch statistics", e);
            System.exit(1);
        }
    }
}
