package com.elasticemail.examples;

import com.elasticemail.api.VerificationsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.EmailValidationResult;

public class EmailVerification {
    public static void main(String[] args) {
        VerificationsApi verificationsApi = new VerificationsApi(Ee.client());

        // Usage: mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.EmailVerification -Dexec.args="someone@example.com"
        String email = args.length > 0 && !args[0].isEmpty() ? args[0] : Ee.to();

        // Email verification is a paid feature. Accounts without it get a 4xx here.
        try {
            verificationsApi.verificationsByEmailPost(email);
            EmailValidationResult r = verificationsApi.verificationsByEmailGet(email);

            System.out.println("=== Verification result ===");
            System.out.println("Email:       " + r.getEmail());
            System.out.println("Result:      " + r.getResult());
            System.out.println("Reason:      " + (r.getReason() == null ? "" : r.getReason()));
            System.out.println("Disposable:  " + r.getDisposable());
            System.out.println("Role:        " + r.getRole());
            if (r.getSuggestedSpelling() != null) {
                System.out.println("Did you mean: " + r.getSuggestedSpelling());
            }
        } catch (ApiException e) {
            Ee.printApiError("verify email", e);
            System.exit(1);
        }
    }
}
