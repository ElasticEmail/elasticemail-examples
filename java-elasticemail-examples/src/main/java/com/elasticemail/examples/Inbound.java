package com.elasticemail.examples;

import com.elasticemail.api.InboundRouteApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.InboundPayload;
import com.elasticemail.model.InboundRoute;
import com.elasticemail.model.InboundRouteActionType;
import com.elasticemail.model.InboundRouteFilterType;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class Inbound {
    public static void main(String[] args) {
        InboundRouteApi inboundApi = new InboundRouteApi(Ee.client());

        String publicUrl = Ee.env("PUBLIC_URL", "http://localhost:3000");
        String token = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");
        String domain = Ee.env("SENDING_DOMAIN", "yourdomain.com");

        // Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
        // Matching emails are parsed and POSTed as form fields to HttpAddress
        // (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
        // See javalin_app/App.java for the receiving handler.

        String routeId = null;
        try {
            InboundRoute created = inboundApi.inboundroutePost(new InboundPayload()
                    .name("examples-inbound")
                    .filter("*@" + domain)
                    .filterType(InboundRouteFilterType.EMAIL_ADDRESS)
                    .actionType(InboundRouteActionType.NOTIFY_VIA_HTTP)
                    .httpAddress(publicUrl + "/inbound?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8)));
            routeId = created.getPublicId();
            System.out.println("Inbound route created: " + routeId + " " + created.getFilter()
                    + " -> " + created.getActionParameter());
        } catch (ApiException e) {
            fail("create route", e);
        }

        try {
            List<InboundRoute> routes = inboundApi.inboundrouteGet();
            System.out.println("\nInbound routes (" + routes.size() + "):");
            for (InboundRoute r : routes) {
                System.out.println(" - [" + r.getSortOrder() + "] " + r.getPublicId() + " " + r.getName() + ": "
                        + r.getFilterType() + "=" + r.getFilter() + " " + r.getActionType() + " "
                        + (r.getActionParameter() == null ? "" : r.getActionParameter()));
            }
        } catch (ApiException e) {
            fail("list routes", e);
        }

        // Delete the route we created (comment out to keep it)
        if (routeId != null) {
            try {
                inboundApi.inboundrouteByIdDelete(routeId);
                System.out.println("\nInbound route deleted: " + routeId);
            } catch (ApiException e) {
                fail("delete route", e);
            }
        }
    }

    private static void fail(String step, ApiException e) {
        Ee.printApiError(step, e);
        System.exit(1);
    }
}
