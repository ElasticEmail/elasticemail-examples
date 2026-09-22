package com.elasticemail.springboot;

import com.elasticemail.client.ApiException;
import org.springframework.http.ResponseEntity;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

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

    /** Responds with the API status code and the Error message from the response body. */
    static ResponseEntity<Map<String, Object>> apiError(ApiException e) {
        int status = e.getCode() >= 400 ? e.getCode() : 500;
        String body = e.getResponseBody();
        String message = body == null || body.isEmpty() ? e.getMessage() : body;
        return ResponseEntity.status(status).body(Map.of("error", message == null ? "Unknown error" : message));
    }
}
