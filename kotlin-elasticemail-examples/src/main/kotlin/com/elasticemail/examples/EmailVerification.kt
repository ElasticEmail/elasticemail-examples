package com.elasticemail.examples

import com.elasticemail.api.VerificationsApi
import com.elasticemail.client.ApiException

fun main(args: Array<String>) {
    val verificationsApi = VerificationsApi(Ee.client())

    // Usage: mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.EmailVerificationKt -Dexec.args="someone@example.com"
    val email = args.getOrNull(0)?.takeIf { it.isNotEmpty() } ?: Ee.to()

    // Email verification is a paid feature. Accounts without it get a 4xx here.
    try {
        verificationsApi.verificationsByEmailPost(email)
        val r = verificationsApi.verificationsByEmailGet(email)

        println("=== Verification result ===")
        println("Email:       ${r.email}")
        println("Result:      ${r.result}")
        println("Reason:      ${r.reason.orEmpty()}")
        println("Disposable:  ${r.disposable}")
        println("Role:        ${r.role}")
        r.suggestedSpelling?.let { println("Did you mean: $it") }
    } catch (e: ApiException) {
        Ee.fail("verify email", e)
    }
}
