package com.elasticemail.examples

import com.elasticemail.api.EmailsApi
import com.elasticemail.client.ApiException
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    // Usage: mvn -q compile exec:java -Dexec.mainClass=com.elasticemail.examples.EmailStatusKt -Dexec.args="<transactionId> [messageId]"
    // Both ids are returned by every send call.
    val transactionId = args.getOrNull(0)
    if (transactionId.isNullOrEmpty()) {
        System.err.println("Usage: EmailStatus <transactionId> [messageId]")
        exitProcess(1)
    }
    val messageId = args.getOrNull(1)

    val emailsApi = EmailsApi(Ee.client())

    try {
        val s = emailsApi.emailsByTransactionidStatusGet(
            transactionId,
            true, // showFailed
            true, // showSent
            true, // showDelivered
            true, // showPending
            true, // showOpened
            true, // showClicked
            false, // showAbuse
            false, // showUnsubscribed
            false, // showErrors
            false, // showMessageIDs
        )

        println("=== Transaction status ===")
        println("Status:      ${s.status}")
        println("Recipients:  ${s.recipientsCount}")
        println("Sent:        ${s.sentCount} ${s.sent.orEmpty()}")
        println("Delivered:   ${s.deliveredCount} ${s.delivered.orEmpty()}")
        println("Pending:     ${s.pendingCount}")
        println("Opened:      ${s.openedCount}")
        println("Clicked:     ${s.clickedCount}")
        print("Failed:      ${s.failedCount}")
        s.failed?.forEach { f -> print(" ${f.address} (${f.error})") }
        println()
    } catch (e: ApiException) {
        Ee.fail("fetch status", e)
    }

    if (messageId != null) {
        try {
            val m = emailsApi.emailsByMsgidViewGet(messageId)
            println("\n=== Message ===")
            println("From:     ${m.preview?.from.orEmpty()}")
            println("Subject:  ${m.preview?.subject.orEmpty()}")
            m.status?.let { println("Status:   ${it.statusName} ${it.dateSent ?: ""}") }
            val body = m.preview?.body.orEmpty()
            println("Body preview: ${if (body.length > 200) body.take(200) + "..." else body}")
        } catch (e: ApiException) {
            Ee.printApiError("fetch message", e)
        }
    }
}
