package com.elasticemail.examples

import com.elasticemail.api.InboundRouteApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.InboundPayload
import com.elasticemail.model.InboundRouteActionType
import com.elasticemail.model.InboundRouteFilterType
import java.net.URLEncoder

fun main(args: Array<String>) {
    val inboundApi = InboundRouteApi(Ee.client())

    val publicUrl = Ee.env("PUBLIC_URL", "http://localhost:3000")
    val token = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
    val domain = Ee.env("SENDING_DOMAIN", "yourdomain.com")

    // Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
    // Matching emails are parsed and POSTed as form fields to HttpAddress
    // (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
    // See ktor_app/App.kt for the receiving handler.

    val routeId = try {
        val created = inboundApi.inboundroutePost(
            InboundPayload()
                .name("examples-inbound")
                .filter("*@$domain")
                .filterType(InboundRouteFilterType.EMAIL_ADDRESS)
                .actionType(InboundRouteActionType.NOTIFY_VIA_HTTP)
                .httpAddress("$publicUrl/inbound?token=${URLEncoder.encode(token, Charsets.UTF_8)}"),
        )
        println("Inbound route created: ${created.publicId} ${created.filter} -> ${created.actionParameter}")
        created.publicId
    } catch (e: ApiException) {
        Ee.fail("create route", e)
    }

    try {
        val routes = inboundApi.inboundrouteGet()
        println("\nInbound routes (${routes.size}):")
        for (r in routes) {
            println(
                " - [${r.sortOrder}] ${r.publicId} ${r.name}: ${r.filterType}=${r.filter} ${r.actionType} " +
                    r.actionParameter.orEmpty(),
            )
        }
    } catch (e: ApiException) {
        Ee.fail("list routes", e)
    }

    // Delete the route we created (comment out to keep it)
    if (routeId != null) {
        try {
            inboundApi.inboundrouteByIdDelete(routeId)
            println("\nInbound route deleted: $routeId")
        } catch (e: ApiException) {
            Ee.fail("delete route", e)
        }
    }
}
