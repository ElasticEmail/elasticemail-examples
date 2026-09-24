package com.elasticemail.examples

import com.elasticemail.api.StatisticsApi
import com.elasticemail.client.ApiException
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

fun main(args: Array<String>) {
    val statisticsApi = StatisticsApi(Ee.client())

    // Account-wide sending statistics for the last 30 days.
    // The SDK serializes OffsetDateTime as ISO 8601; use UTC so the range matches the dashboard.
    val to = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.SECONDS)
    val from = to.minusDays(30)

    try {
        val s = statisticsApi.statisticsGet(from, to)

        println("=== Statistics $from to $to ===")
        println("Recipients:    ${s.recipients}")
        println("Emails total:  ${s.emailTotal}")
        println("Delivered:     ${s.delivered}")
        println("Bounced:       ${s.bounced}")
        println("In progress:   ${s.inProgress}")
        println("Opened:        ${s.opened}")
        println("Clicked:       ${s.clicked}")
        println("Unsubscribed:  ${s.unsubscribed}")
        println("Complaints:    ${s.complaints}")
    } catch (e: ApiException) {
        Ee.fail("fetch statistics", e)
    }
}
