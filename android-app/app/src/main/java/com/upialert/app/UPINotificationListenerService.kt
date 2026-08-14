package com.upialert.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
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
        const val EXTRA_RAW_LOG = "extra_raw_log"

        private const val CHANNEL_ID = "upi_listener_fg_channel"
        private const val NOTIFICATION_ID = 1001

        private val recentPayments = mutableMapOf<String, Long>()
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        startForegroundNotification()
        Log.d(TAG, "UPINotificationListenerService Created & Started in Foreground")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundNotification()
        return START_STICKY
    }

    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "UPI Alert Service Active",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps UPI Alert listener active in the background for live streaming"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("UPI StreamAlert is Active 🟢")
            .setContentText("Listening for live UPI payment notifications...")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        try {
            startForeground(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Foreground start exception: ", e)
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val packageName = sbn.packageName ?: ""
        val extras = sbn.notification?.extras ?: return

        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""
        val subText = extras.getCharSequence("android.subText")?.toString() ?: ""
        val tickerText = sbn.notification?.tickerText?.toString() ?: ""

        val fullContent = listOf(title, text, bigText, subText, tickerText)
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString(" ")

        Log.d(TAG, "Intercepted [$packageName]: $fullContent")

        // Parse notification
        val parseResult = UPIParser.parseNotification(packageName, title, fullContent)
        if (parseResult != null && parseResult.amount > 0) {
            val appDisplayName = getAppDisplayName(packageName)
            val dedupeKey = "${parseResult.username.toLowerCase()}_${parseResult.amount.toInt()}"
            val currentTime = System.currentTimeMillis()

            // Deduplication (10 seconds)
            val lastSeen = recentPayments[dedupeKey] ?: 0L
            if (currentTime - lastSeen < 10000) {
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

            Log.d(TAG, "🎉 PARSED UPI DONATION: ${donation.username} donated ₹${donation.amount} via ${donation.sourceApp}")

            // Send to Cloud Relay
            serviceScope.launch {
                val prefs = getSharedPreferences("upi_alert_prefs", Context.MODE_PRIVATE)
                val serverUrl = prefs.getString("server_url", "https://ntfy.sh/upi_alert_jaanedobhai_live") ?: "https://ntfy.sh/upi_alert_jaanedobhai_live"
                val apiToken = prefs.getString("api_token", "upi_stream_secret_123") ?: "upi_stream_secret_123"

                val success = NetworkClient.sendAlert(applicationContext, donation, serverUrl, apiToken)
                donation.status = if (success) "Sent ✅" else "Failed ❌"

                // Broadcast update to MainActivity
                val intent = Intent(ACTION_NEW_DONATION).apply {
                    putExtra(EXTRA_USERNAME, donation.username)
                    putExtra(EXTRA_AMOUNT, donation.amount)
                    putExtra(EXTRA_APP, donation.sourceApp)
                    putExtra(EXTRA_STATUS, donation.status)
                    setPackage(applicationContext.packageName)
                }
                sendBroadcast(intent)
            }
        }
    }

    private fun getAppDisplayName(pkg: String): String {
        return when {
            pkg.contains("npci") || pkg.contains("bhim") -> "BHIM UPI"
            pkg.contains("paisa") || pkg.contains("gpay") -> "Google Pay"
            pkg.contains("phonepe") -> "PhonePe"
            pkg.contains("paytm") -> "Paytm"
            pkg.contains("cred") -> "CRED"
            pkg.contains("amazon") -> "Amazon Pay"
            pkg.contains("sms") || pkg.contains("mms") || pkg.contains("messaging") -> "Bank SMS"
            else -> "UPI App"
        }
    }
}
