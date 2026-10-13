package com.elasticemail.springboot;

import com.elasticemail.client.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

/** Helpers shared by the controllers. */
final class Support {
    private Support() {}

    /** Strip newlines from user-controlled values before logging */
    static String sanitize(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n]", "");
    }

    /** Constant-time comparison of the shared secret carried in ?token= */
    static boolean tokenOk(String token, String expected) {
        byte[] a = (token == null ? "" : token).getBytes(StandardCharsets.UTF_8);
        byte[] b = expected.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    static String hmacSha256Hex(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** How far (seconds) X-ElasticEmail-Timestamp may be from the current time. */
    public static final long SIGNATURE_TOLERANCE_SECONDS = 300;

    private static final ObjectMapper JSON = new ObjectMapper();

    /**
     * Checks an Elastic Email webhook signature:
     * hex(HMAC-SHA256(secret, timestamp + "\n" + METHOD + "\n" + target + "\n" + body)), where
     * target is the path and query exactly as received on the request line. The signature header
     * is a comma-separated list; any matching {@code v1=} entry is accepted.
     */
    public static boolean verifySignature(String secret, String timestamp, String signature,
                                          String method, String target, byte[] body, long nowSeconds) {
        if (secret == null || secret.isEmpty() || timestamp == null || signature == null) {
            return false;
        }
        long ts;
        try {
            ts = Long.parseLong(timestamp);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) {
            return false;
        }
        byte[] expected;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            mac.update((timestamp + "\n" + method + "\n" + target + "\n").getBytes(StandardCharsets.UTF_8));
            expected = HexFormat.of().formatHex(mac.doFinal(body == null ? new byte[0] : body))
                    .getBytes(StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        for (String entry : signature.split(",")) {
            String value = entry.trim();
            if (value.startsWith("v1=")
                    && MessageDigest.isEqual(value.substring(3).getBytes(StandardCharsets.UTF_8), expected)) {
                return true;
            }
        }
        return false;
    }

    /** Result of readWebhook: the event fields (lower-cased names), or the status and error to answer with. */
    public record WebhookRequest(Map<String, String> event, int status, String error) {
        public boolean ok() {
            return event != null;
        }
    }

    /**
     * Authenticates an event notification and returns its fields under lower-cased names.
     * With a signing secret (ELASTICEMAIL_WEBHOOK_SECRET) the request must carry a valid signature;
     * without one it must carry {@code ?token=} equal to {@code token}. Signed webhooks are usually
     * POST with a JSON body; GET webhooks carry the fields in the query string. {@code target} is
     * the raw path and query and {@code body} the raw bytes, read before any parsing. A 401 makes
     * Elastic Email retry.
     */
    public static WebhookRequest readWebhook(String secret, String token, String method, String target,
                                             Function<String, String> header, byte[] body) {
        int q = target.indexOf('?');
        Map<String, String> query = parseForm(q < 0 ? "" : target.substring(q + 1));

        if (secret != null && !secret.isEmpty()) {
            if (!verifySignature(secret, header.apply("X-ElasticEmail-Timestamp"), header.apply("X-ElasticEmail-Signature"),
                    method, target, body, System.currentTimeMillis() / 1000)) {
                return new WebhookRequest(null, 401, "Invalid signature");
            }
        } else {
            byte[] given = query.getOrDefault("token", "").getBytes(StandardCharsets.UTF_8);
            if (!MessageDigest.isEqual(given, (token == null ? "" : token).getBytes(StandardCharsets.UTF_8))) {
                return new WebhookRequest(null, 401, "Invalid token");
            }
        }

        Map<String, String> event = new HashMap<>(query);
        String text = body == null ? "" : new String(body, StandardCharsets.UTF_8).trim();
        if (text.startsWith("{")) {
            // PostJson: a flat object; to, from, channel, subject and messageid may be null.
            try {
                Map<?, ?> fields = JSON.readValue(text, Map.class);
                fields.forEach((k, v) -> event.put(String.valueOf(k).toLowerCase(Locale.ROOT), v == null ? "" : String.valueOf(v)));
            } catch (Exception e) {
                return new WebhookRequest(null, 400, "Invalid JSON body");
            }
        } else if (!text.isEmpty()) {
            event.putAll(parseForm(text));
        }
        return new WebhookRequest(event, 200, null);
    }

    /** Parses a URL-encoded query string or form body; names are lower-cased, first value wins. */
    private static Map<String, String> parseForm(String encoded) {
        Map<String, String> fields = new HashMap<>();
        for (String pair : encoded.split("&")) {
            if (pair.isEmpty()) {
                continue;
            }
            int eq = pair.indexOf('=');
            String key = URLDecoder.decode(eq < 0 ? pair : pair.substring(0, eq), StandardCharsets.UTF_8);
            String value = eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
            fields.putIfAbsent(key.toLowerCase(Locale.ROOT), value);
        }
        return fields;
    }

    /**
     * readWebhook for a servlet request. getRequestURI() is not URL-decoded, so together with the raw
     * query string it is the request target as sent; body is the raw @RequestBody byte[].
     */
    static WebhookRequest readWebhook(String secret, String token, HttpServletRequest request, byte[] body) {
        String query = request.getQueryString();
        String target = request.getRequestURI() + (query == null ? "" : "?" + query);
        return readWebhook(secret, token, request.getMethod(), target, request::getHeader, body);
    }

    /** Responds with the API status code and the Error message from the response body. */
    static ResponseEntity<Map<String, Object>> apiError(ApiException e) {
        int status = e.getCode() >= 400 ? e.getCode() : 500;
        String body = e.getResponseBody();
        String message = body == null || body.isEmpty() ? e.getMessage() : body;
        return ResponseEntity.status(status).body(Map.of("error", message == null ? "Unknown error" : message));
    }
}
