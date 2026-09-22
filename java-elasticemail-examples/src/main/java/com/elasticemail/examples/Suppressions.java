package com.elasticemail.examples;

import com.elasticemail.api.SuppressionsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.Suppression;

import java.util.List;

public class Suppressions {
    public static void main(String[] args) {
        SuppressionsApi suppressionsApi = new SuppressionsApi(Ee.client());
        String email = args.length > 0 && !args[0].isEmpty() ? args[0] : "suppressed@example.com";

        // Suppressions are split into unsubscribes, bounces and complaints.
        // Adding to any list stops future sends to that address.
        try {
            suppressionsApi.suppressionsUnsubscribesPost(List.of(email));
            System.out.println("Added to unsubscribes: " + email);
        } catch (ApiException e) {
            fail("add unsubscribe", e);
        }

        try {
            Suppression s = suppressionsApi.suppressionsByEmailGet(email);
            System.out.println("Suppression: Email=" + s.getEmail() + " Reason=" + s.getFriendlyErrorMessage()
                    + " DateUpdated=" + s.getDateUpdated());
        } catch (ApiException e) {
            fail("get suppression", e);
        }

        try {
            List<Suppression> all = suppressionsApi.suppressionsGet(10, 0);
            System.out.println("\nAll suppressions (first " + all.size() + "):");
            for (Suppression s : all) {
                System.out.println(" - " + s.getEmail() + " " + (s.getFriendlyErrorMessage() == null ? "" : s.getFriendlyErrorMessage()));
            }
        } catch (ApiException e) {
            fail("list suppressions", e);
        }

        // Remove it again so the address can receive email
        try {
            suppressionsApi.suppressionsByEmailDelete(email);
            System.out.println("\nRemoved from suppressions: " + email);
        } catch (ApiException e) {
            fail("delete suppression", e);
        }
    }

    private static void fail(String step, ApiException e) {
        Ee.printApiError(step, e);
        System.exit(1);
    }
}
