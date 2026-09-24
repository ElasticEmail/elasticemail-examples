package com.elasticemail.examples

import com.elasticemail.api.SuppressionsApi
import com.elasticemail.client.ApiException

fun main(args: Array<String>) {
    val suppressionsApi = SuppressionsApi(Ee.client())
    val email = args.getOrNull(0)?.takeIf { it.isNotEmpty() } ?: "suppressed@example.com"

    // Suppressions are split into unsubscribes, bounces and complaints.
    // Adding to any list stops future sends to that address.
    try {
        suppressionsApi.suppressionsUnsubscribesPost(listOf(email))
        println("Added to unsubscribes: $email")
    } catch (e: ApiException) {
        Ee.fail("add unsubscribe", e)
    }

    try {
        val s = suppressionsApi.suppressionsByEmailGet(email)
        println("Suppression: Email=${s.email} Reason=${s.friendlyErrorMessage} DateUpdated=${s.dateUpdated}")
    } catch (e: ApiException) {
        Ee.fail("get suppression", e)
    }

    try {
        val all = suppressionsApi.suppressionsGet(10, 0)
        println("\nAll suppressions (first ${all.size}):")
        for (s in all) {
            println(" - ${s.email} ${s.friendlyErrorMessage.orEmpty()}")
        }
    } catch (e: ApiException) {
        Ee.fail("list suppressions", e)
    }

    // Remove it again so the address can receive email
    try {
        suppressionsApi.suppressionsByEmailDelete(email)
        println("\nRemoved from suppressions: $email")
    } catch (e: ApiException) {
        Ee.fail("delete suppression", e)
    }
}
