package com.elasticemail.examples;

import com.elasticemail.api.SubAccountsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.SubAccountInfo;
import com.elasticemail.model.SubaccountEmailCreditsPayload;
import com.elasticemail.model.SubaccountPayload;

import java.util.List;
import java.util.UUID;

public class SubAccounts {
    public static void main(String[] args) {
        SubAccountsApi subAccountsApi = new SubAccountsApi(Ee.client());

        // Sub-accounts let you isolate customers or projects with their own API keys and credits.
        // Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.
        boolean createEnabled = "true".equals(Ee.env("CREATE_SUBACCOUNT", "false"));
        String subEmail = Ee.env("SUBACCOUNT_EMAIL", "sub-" + System.currentTimeMillis() + "@example.com");

        try {
            List<SubAccountInfo> subs = subAccountsApi.subaccountsGet(20, 0);
            System.out.println("Sub-accounts (" + subs.size() + "):");
            for (SubAccountInfo s : subs) {
                System.out.println(" - " + s.getEmail() + " status=" + s.getStatus() + " credits=" + s.getEmailCredits()
                        + " sent=" + s.getTotalEmailsSent());
            }
        } catch (ApiException e) {
            fail("list sub-accounts", e);
        }

        if (!createEnabled) {
            System.out.println("\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.");
            return;
        }

        try {
            SubAccountInfo created = subAccountsApi.subaccountsPost(new SubaccountPayload()
                    .email(subEmail)
                    .password("Tmp-" + UUID.randomUUID().toString().substring(0, 12) + "-Aa1!")
                    .sendActivation(false));
            System.out.println("\nSub-account created: " + created.getEmail());

            subAccountsApi.subaccountsByEmailCreditsPatch(subEmail,
                    new SubaccountEmailCreditsPayload().credits(1000).notes("Initial allocation"));
            System.out.println("Assigned 1000 credits to " + subEmail);

            String key = subAccountsApi.subaccountsByEmailApikeyGet(subEmail);
            System.out.println("Sub-account API key retrieved (length): " + key.length());
        } catch (ApiException e) {
            fail("create sub-account", e);
        }
    }

    private static void fail(String step, ApiException e) {
        Ee.printApiError(step, e);
        System.exit(1);
    }
}
