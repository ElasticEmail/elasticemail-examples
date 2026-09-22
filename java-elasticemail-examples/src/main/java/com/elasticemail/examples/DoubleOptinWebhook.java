package com.elasticemail.examples;

import com.elasticemail.api.ListsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.EmailsPayload;
import io.javalin.Javalin;
import io.javalin.http.Context;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Alternative confirmation flow driven by Elastic Email click tracking.
 * Create a webhook (see Webhooks.java) pointing at POST /double-optin/webhook.
 * When the recipient clicks the confirm link, Elastic Email reports status=Clicked
 * with the clicked URL in "target". The contact is then added to the list.
 */
public class DoubleOptinWebhook {
    private static ListsApi listsApi;
    private static String listName;
    private static String expectedToken;

    public static void main(String[] args) {
        listsApi = new ListsApi(Ee.client());
        listName = Ee.env("ELASTICEMAIL_LIST_NAME", "Newsletter");
        expectedToken = Ee.env("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me");

        int port = Integer.parseInt(Ee.env("PORT", "3000"));
        Javalin app = Javalin.create().start(port);

        // Elastic Email validates the URL with a GET when the webhook is saved.
        app.get("/double-optin/webhook", ctx -> {
            if (!tokenOk(ctx.queryParam("token"))) {
                ctx.status(401).json(Map.of("error", "Invalid token"));
                return;
            }
            ctx.json(Map.of("ok", true));
        });

        app.post("/double-optin/webhook", DoubleOptinWebhook::handle);

        System.out.println("Double opt-in webhook listening on http://localhost:" + port + "/double-optin/webhook");
    }

    private static void handle(Context ctx) {
        if (!tokenOk(ctx.queryParam("token"))) {
            ctx.status(401).json(Map.of("error", "Invalid token"));
            return;
        }

        Map<String, String> event = params(ctx);
        String status = sanitize(event.get("status"));
        String target = sanitize(event.get("target"));
        String recipient = sanitize(event.get("to"));

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

    /** Query string parameters first, form fields override (Elastic Email posts form-encoded). */
    private static Map<String, String> params(Context ctx) {
        Map<String, String> merged = new HashMap<>();
        ctx.queryParamMap().forEach((k, v) -> merged.put(k, v.isEmpty() ? "" : v.get(0)));
        ctx.formParamMap().forEach((k, v) -> merged.put(k, v.isEmpty() ? "" : v.get(0)));
        return merged;
    }

    private static boolean tokenOk(String token) {
        byte[] a = (token == null ? "" : token).getBytes(StandardCharsets.UTF_8);
        byte[] b = expectedToken.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    private static String sanitize(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n]", "");
    }
}
