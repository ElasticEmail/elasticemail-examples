package com.elasticemail.examples

import com.elasticemail.api.SubAccountsApi
import com.elasticemail.client.ApiException
import com.elasticemail.model.SubaccountEmailCreditsPayload
import com.elasticemail.model.SubaccountPayload
import java.util.UUID

fun main(args: Array<String>) {
    val subAccountsApi = SubAccountsApi(Ee.client())

    // Sub-accounts let you isolate customers or projects with their own API keys and credits.
    // Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.
    val createEnabled = Ee.env("CREATE_SUBACCOUNT", "false") == "true"
    val subEmail = Ee.env("SUBACCOUNT_EMAIL", "sub-${System.currentTimeMillis()}@example.com")

    try {
        val subs = subAccountsApi.subaccountsGet(20, 0)
        println("Sub-accounts (${subs.size}):")
        for (s in subs) {
            println(" - ${s.email} status=${s.status} credits=${s.emailCredits} sent=${s.totalEmailsSent}")
        }
    } catch (e: ApiException) {
        Ee.fail("list sub-accounts", e)
    }

    if (!createEnabled) {
        println("\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.")
        return
    }

    try {
        val created = subAccountsApi.subaccountsPost(
            SubaccountPayload()
                .email(subEmail)
                .password("Tmp-${UUID.randomUUID().toString().take(12)}-Aa1!")
                .sendActivation(false),
        )
        println("\nSub-account created: ${created.email}")

        subAccountsApi.subaccountsByEmailCreditsPatch(
            subEmail,
            SubaccountEmailCreditsPayload().credits(1000).notes("Initial allocation"),
        )
        println("Assigned 1000 credits to $subEmail")

        val key = subAccountsApi.subaccountsByEmailApikeyGet(subEmail)
        println("Sub-account API key retrieved (length): ${key.length}")
    } catch (e: ApiException) {
        Ee.fail("create sub-account", e)
    }
}
