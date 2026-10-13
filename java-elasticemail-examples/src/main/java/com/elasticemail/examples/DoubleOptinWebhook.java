package com.elasticemail.examples;

import com.elasticemail.api.ListsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.EmailsPayload;
import io.javalin.Javalin;
import io.javalin.http.Context;

import java.util.List;
import java.util.Map;

/**
 * Alternative confirmation flow driven by Elastic Email click tracking.
 * Create a webhook (see Webhooks.java) pointing at /double-optin/webhook.
 * When the recipient clicks the confirm link, Elastic Email reports status=Clicked
 * with the clicked URL in "target". The contact is then added to the list.
 */
public class DoubleOptinWebhook {
    private static ListsApi listsApi;
    private static String listName;
    private static String expectedToken;
    private static String webhookSecret;

    public static void main(String[] args) {
        listsApi = new ListsApi(Ee.client());
        listName = Ee.env("ELASTICEMAIL_LIST_NAME", "Newsletter");
        expectedToken = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");
        webhookSecret = Ee.env("ELASTICEMAIL_WEBHOOK_SECRET", "");

        int port = Integer.parseInt(Ee.env("PORT", "3000"));
        Javalin app = Javalin.create().start(port);

        app.get("/double-optin/webhook", DoubleOptinWebhook::handle);
        app.post("/double-optin/webhook", DoubleOptinWebhook::handle);

        System.out.println("Double opt-in webhook listening on http://localhost:" + port + "/double-optin/webhook");
    }

    private static void handle(Context ctx) {
        // Signed webhooks (POST + JSON) are verified with ELASTICEMAIL_WEBHOOK_SECRET; unsigned ones
        // (GET + query string) with ?token=ELASTICEMAIL_WEBHOOK_TOKEN. The signature covers the raw
        // request target (getRequestURI() is not URL-decoded) and the raw body bytes.
        String query = ctx.req().getQueryString();
        String requestTarget = ctx.req().getRequestURI() + (query == null ? "" : "?" + query);
        Ee.WebhookRequest webhook = Ee.readWebhook(webhookSecret, expectedToken, ctx.method().name(),
                requestTarget, ctx::header, ctx.bodyAsBytes());
        if (!webhook.ok()) {
            ctx.status(webhook.status()).json(Map.of("error", webhook.error()));
            return;
        }

        Map<String, String> event = webhook.event();
        String status = sanitize(event.get("status"));
        String target = sanitize(event.get("target"));
        String recipient = sanitize(event.get("to"));

        // Test request sent when the webhook is saved.
        if (status.isEmpty()) {
            ctx.json(Map.of("ok", true));
            return;
        }

        if (!"Clicked".equals(status) || !target.contains("/double-optin/confirm")) {
            ctx.json(Map.of("received", true, "status", status, "message", "Event ignored"));
            return;
        }

        try {
            listsApi.listsByNameContactsPost(listName, new EmailsPayload().emails(List.of(recipient)));
            System.out.println("Subscription confirmed via click: " + recipient);
            ctx.json(Map.of("received", true, "confirmed", true, "email", recipient, "list", listName));
        } catch (ApiException e) {
            Ee.printApiError("add contact to list", e);
            ctx.status(500).json(Map.of("error", Ee.errorBody(e)));
        }
    }

    private static String sanitize(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n]", "");
    }
}
