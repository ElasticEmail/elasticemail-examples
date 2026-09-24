package com.elasticemail.examples;

import com.elasticemail.client.ApiClient;
import com.elasticemail.client.ApiException;
import com.elasticemail.client.Configuration;
import com.elasticemail.client.auth.ApiKeyAuth;
import io.github.cdimascio.dotenv.Dotenv;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Shared setup for the standalone examples and javalin_app: loads .env, builds an authenticated
 * ApiClient, exposes the common environment values and the input-safety helpers.
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

    // ---- Input safety -------------------------------------------------------------------------
    // Elastic Email treats {...} and {{...}} in message content as template syntax, so strip braces
    // from user input.

    /** Escapes a user-supplied value for an HTML body, braces included. */
    public static String escapeHtml(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                case '{' -> out.append("&#123;");
                case '}' -> out.append("&#125;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    /** Removes braces. Use for user values in PlainText bodies and contact fields. */
    public static String plainText(String s) {
        return s == null ? "" : s.replace("{", "").replace("}", "");
    }

    /** plainText plus no CR/LF. Use for Subject and other header-like fields. */
    public static String headerText(String s) {
        return plainText(s).replace("\r", "").replace("\n", "");
    }

    /** Address shape check: exactly one @, no whitespace or line breaks. */
    public static boolean validAddress(String email) {
        if (email == null || email.isEmpty() || email.chars().anyMatch(Character::isWhitespace)) {
            return false;
        }
        int at = email.indexOf('@');
        return at >= 0 && at == email.lastIndexOf('@');
    }

    /** EMAIL_ALLOWED_DOMAINS split on commas; defaults to the domain of EMAIL_TO. */
    public static List<String> allowedDomains(String allowedCsv, String emailTo) {
        List<String> domains = Arrays.stream(allowedCsv == null ? new String[0] : allowedCsv.split(","))
                .map(d -> d.trim().toLowerCase(Locale.ROOT))
                .filter(d -> !d.isEmpty())
                .toList();
        if (domains.isEmpty() && emailTo != null && emailTo.contains("@")) {
            String d = emailTo.substring(emailTo.lastIndexOf('@') + 1).trim().toLowerCase(Locale.ROOT);
            if (!d.isEmpty()) {
                domains = List.of(d);
            }
        }
        return domains;
    }

    /** True when the recipient is a well-formed address on an allowed domain. */
    public static boolean recipientAllowed(String email, List<String> allowedDomains) {
        if (!validAddress(email)) {
            return false;
        }
        String domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase(Locale.ROOT);
        return allowedDomains.contains(domain);
    }

    /** Constant-time string comparison for tokens. */
    public static boolean tokenEquals(String given, String expected) {
        byte[] a = (given == null ? "" : given).getBytes(StandardCharsets.UTF_8);
        byte[] b = (expected == null ? "" : expected).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    /** True when the Authorization header is exactly "Bearer <token>". */
    public static boolean bearerOk(String authorization, String token) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return false;
        }
        return tokenEquals(authorization.substring("Bearer ".length()), token);
    }

    public static String hmacSha256Hex(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Double opt-in confirm token: HMAC-SHA256 over email + "\n" + expires (unix seconds). */
    public static String confirmToken(String secret, String email, long expires) {
        return hmacSha256Hex(secret, email + "\n" + expires);
    }

    /** Validates the email/expires/token triple of a confirm link. */
    public static boolean confirmLinkOk(String secret, String email, String expires, String token) {
        if (email == null || email.isEmpty() || expires == null || token == null || token.isEmpty()) {
            return false;
        }
        long exp;
        try {
            exp = Long.parseLong(expires);
        } catch (NumberFormatException e) {
            return false;
        }
        if (exp < System.currentTimeMillis() / 1000) {
            return false;
        }
        return tokenEquals(token, confirmToken(secret, email, exp));
    }

    /**
     * Webhook token placeholder check for long-running servers. Warns for local URLs,
     * exits when the placeholder would be exposed at a public URL.
     */
    public static void checkWebhookToken(String token, String publicUrl) {
        if (token != null && !token.isEmpty() && !"change_me".equals(token)) {
            return;
        }
        String host = "";
        if (publicUrl != null && !publicUrl.isEmpty()) {
            try {
                String h = URI.create(publicUrl).getHost();
                host = h == null ? "" : h.replace("[", "").replace("]", "");
            } catch (IllegalArgumentException e) {
                host = "";
            }
        }
        if (publicUrl == null || publicUrl.isEmpty()
                || host.equals("localhost") || host.equals("127.0.0.1") || host.equals("::1")) {
            System.err.println("ELASTICEMAIL_WEBHOOK_TOKEN is the placeholder; fine for local testing only");
            return;
        }
        System.err.println("Refusing to start: set ELASTICEMAIL_WEBHOOK_TOKEN before exposing webhooks at " + publicUrl);
        System.exit(1);
    }

    /**
     * Fixed-window rate limiter. In-memory limits are per process; use a shared store
     * (Redis, the platform's rate limiter) in production.
     */
    public static final class RateLimiter {
        private final int limit;
        private final long windowMillis;
        private final Map<String, long[]> windows = new HashMap<>();

        public RateLimiter(int limit, long windowSeconds) {
            this.limit = limit;
            this.windowMillis = windowSeconds * 1000;
        }

        /** Counts a hit. Returns 0 when allowed, otherwise the seconds until the window resets. */
        public synchronized long hit(String key) {
            long now = System.currentTimeMillis();
            if (windows.size() > 10_000) {
                windows.values().removeIf(w -> now >= w[0]);
            }
            long[] w = windows.get(key);
            if (w == null || now >= w[0]) {
                w = new long[] {now + windowMillis, 0};
                windows.put(key, w);
            }
            if (w[1] >= limit) {
                return Math.max(1, (w[0] - now + 999) / 1000);
            }
            w[1]++;
            return 0;
        }
    }
}
