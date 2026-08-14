package com.upialert.app

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

object NetworkClient {

    private const val TAG = "NetworkClient"
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    private val gson = Gson()

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    suspend fun sendAlert(
        context: Context,
        donation: DonationModel,
        serverUrl: String,
        apiToken: String
    ): Boolean = withContext(Dispatchers.IO) {
        var targetUrl = serverUrl.trim()
        if (targetUrl.isEmpty()) return@withContext false

        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            targetUrl = "https://$targetUrl"
        }

        // Support for Firebase Realtime Database direct REST endpoint
        val isFirebase = targetUrl.contains("firebaseio.com")
        val isNtfy = targetUrl.contains("ntfy.sh")

        if (isFirebase) {
            if (!targetUrl.endsWith(".json")) {
                targetUrl = targetUrl.removeSuffix("/") + "/alerts.json"
            }
        } else if (!isNtfy) {
            // Standard Cloud / Node.js Relay Server endpoint
            if (!targetUrl.endsWith("/api/alert")) {
                targetUrl = targetUrl.removeSuffix("/") + "/api/alert"
            }
        }

        try {
            val jsonPayload = gson.toJson(donation)
            val requestBody = jsonPayload.toRequestBody(JSON_MEDIA_TYPE)

            val requestBuilder = Request.Builder()
                .url(targetUrl)
                .post(requestBody)

            if (!isFirebase && !isNtfy && apiToken.isNotEmpty()) {
                requestBuilder.addHeader("Authorization", "Bearer $apiToken")
                requestBuilder.addHeader("x-api-key", apiToken)
            }

            val request = requestBuilder.build()
            Log.d(TAG, "Posting alert to $targetUrl: $jsonPayload")

            client.newCall(request).execute().use { response ->
                val success = response.isSuccessful
                Log.d(TAG, "Server response: code=${response.code}, success=$success")
                return@withContext success
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send alert to $targetUrl", e)
            return@withContext false
        }
    }
}
