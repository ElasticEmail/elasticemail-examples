package com.elasticemail.examples;

import com.elasticemail.client.ApiClient;
import com.elasticemail.client.ApiException;
import com.elasticemail.client.Configuration;
import com.elasticemail.client.auth.ApiKeyAuth;
import io.github.cdimascio.dotenv.Dotenv;

/**
 * Shared setup for the standalone examples: loads .env, builds an authenticated ApiClient
 * and exposes the common environment values.
 */
public final class Ee {
    private static final Dotenv DOTENV = Dotenv.configure().ignoreIfMissing().load();

    private Ee() {}

    public static String env(String name, String defaultValue) {
        String value = DOTENV.get(name);
        return value == null || value.isEmpty() ? defaultValue : value;
    }

    public static String from() {
        return env("EMAIL_FROM", "Acme <hello@yourdomain.com>");
    }

    public static String to() {
        return env("EMAIL_TO", "you@yourdomain.com");
    }

    public static ApiClient client() {
        String apiKey = env("ELASTICEMAIL_API_KEY", null);
        if (apiKey == null) {
            System.err.println("ELASTICEMAIL_API_KEY environment variable is required");
            System.exit(1);
        }

        ApiClient client = Configuration.getDefaultApiClient();
        ApiKeyAuth apikey = (ApiKeyAuth) client.getAuthentication("apikey");
        apikey.setApiKey(apiKey);
        return client;
    }

    /** Prints the HTTP status and the API error body, e.g. {"Error":"..."}. */
    public static void printApiError(String step, ApiException e) {
        System.err.println("Error (" + step + "): " + e.getCode() + " " + errorBody(e));
    }

    public static String errorBody(ApiException e) {
        String body = e.getResponseBody();
        return body == null || body.isEmpty() ? e.getMessage() : body;
    }
}
