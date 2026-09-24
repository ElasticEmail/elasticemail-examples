package com.elasticemail.examples

import com.elasticemail.client.ApiClient
import com.elasticemail.client.ApiException
import com.elasticemail.client.Configuration
import com.elasticemail.client.auth.ApiKeyAuth
import io.github.cdimascio.dotenv.Dotenv
import kotlin.system.exitProcess

/**
 * Shared setup for the standalone examples: loads .env, builds an authenticated ApiClient
 * and exposes the common environment values.
 */
object Ee {
    private val dotenv: Dotenv = Dotenv.configure().ignoreIfMissing().load()

    fun env(name: String, defaultValue: String): String = env(name) ?: defaultValue

    fun env(name: String): String? = dotenv.get(name)?.takeIf { it.isNotEmpty() }

    fun from(): String = env("EMAIL_FROM", "Acme <hello@yourdomain.com>")

    fun to(): String = env("EMAIL_TO", "you@yourdomain.com")

    fun client(): ApiClient {
        val apiKey = env("ELASTICEMAIL_API_KEY")
        if (apiKey == null) {
            System.err.println("ELASTICEMAIL_API_KEY environment variable is required")
            exitProcess(1)
        }

        val client = Configuration.getDefaultApiClient()
        (client.getAuthentication("apikey") as ApiKeyAuth).apiKey = apiKey
        return client
    }

    /** Prints the HTTP status and the API error body, e.g. {"Error":"..."}. */
    fun printApiError(step: String, e: ApiException) {
        System.err.println("Error ($step): ${e.code} ${errorBody(e)}")
    }

    fun errorBody(e: ApiException): String =
        e.responseBody?.takeIf { it.isNotEmpty() } ?: e.message.orEmpty()

    /** Prints the API error and exits with status 1. */
    fun fail(step: String, e: ApiException): Nothing {
        printApiError(step, e)
        exitProcess(1)
    }
}
