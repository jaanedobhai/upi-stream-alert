package com.upialert.app

import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class UPINotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "UPINotificationService"
        const val ACTION_NEW_DONATION = "com.upialert.app.ACTION_NEW_DONATION"
        const val EXTRA_USERNAME = "extra_username"
        const val EXTRA_AMOUNT = "extra_amount"
        const val EXTRA_APP = "extra_app"
        const val EXTRA_STATUS = "extra_status"
        
        // Cache to deduplicate duplicate notifications (e.g. app notification + SMS)
        private val recentPayments = mutableMapOf<String, Long>()
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val packageName = sbn.packageName ?: ""
        val extras = sbn.notification?.extras ?: return

        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""

        val fullContent = if (bigText.isNotEmpty()) "$title $bigText" else "$title $text"

        Log.d(TAG, "Notification intercepted from $packageName: $fullContent")

        // Parse notification
        val parseResult = UPIParser.parseNotification(packageName, title, fullContent)
        if (parseResult != null && parseResult.amount > 0) {
            val appDisplayName = getAppDisplayName(packageName)
            val dedupeKey = "${parseResult.username}_${parseResult.amount.toInt()}"
            val currentTime = System.currentTimeMillis()

            // Check if duplicate arrived within 15 seconds
            val lastSeen = recentPayments[dedupeKey] ?: 0L
            if (currentTime - lastSeen < 15000) {
                Log.d(TAG, "Duplicate donation ignored: $dedupeKey")
                return
            }
            recentPayments[dedupeKey] = currentTime

            val donation = DonationModel(
                username = parseResult.username,
                amount = parseResult.amount,
                currency = "INR",
                sourceApp = appDisplayName,
                rawText = fullContent
            )

            Log.d(TAG, "🎉 Valid UPI donation parsed: ${donation.username} donated ₹${donation.amount} on ${donation.sourceApp}")

            // Send to Relay Server
            serviceScope.launch {
                val prefs = getSharedPreferences("upi_alert_prefs", Context.MODE_PRIVATE)
                val serverUrl = prefs.getString("server_url", "http://192.168.1.100:3000") ?: "http://192.168.1.100:3000"
                val apiToken = prefs.getString("api_token", "upi_stream_secret_123") ?: "upi_stream_secret_123"

                val success = NetworkClient.sendAlert(applicationContext, donation, serverUrl, apiToken)
                donation.status = if (success) "Sent ✅" else "Failed ❌"

                // Broadcast update to MainActivity UI
                val intent = Intent(ACTION_NEW_DONATION).apply {
                    putExtra(EXTRA_USERNAME, donation.username)
                    putExtra(EXTRA_AMOUNT, donation.amount)
                    putExtra(EXTRA_APP, donation.sourceApp)
                    putExtra(EXTRA_STATUS, donation.status)
                    setPackage(packageName)
                }
                sendBroadcast(intent)
            }
        }
    }

    private fun getAppDisplayName(pkg: String): String {
        return when {
            pkg.contains("paisa") || pkg.contains("gpay") -> "Google Pay"
            pkg.contains("phonepe") -> "PhonePe"
            pkg.contains("paytm") -> "Paytm"
            pkg.contains("npci") || pkg.contains("bhim") -> "BHIM UPI"
            pkg.contains("cred") -> "CRED"
            pkg.contains("amazon") -> "Amazon Pay"
            pkg.contains("sms") || pkg.contains("mms") || pkg.contains("messaging") -> "Bank SMS"
            else -> "UPI App"
        }
    }
}
