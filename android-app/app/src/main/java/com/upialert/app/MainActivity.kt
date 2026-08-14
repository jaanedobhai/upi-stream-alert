package com.upialert.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.upialert.app.databinding.ActivityMainBinding
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: DonationAdapter
    private val donationsList = mutableListOf<DonationModel>()

    private val donationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == UPINotificationListenerService.ACTION_NEW_DONATION) {
                val username = intent.getStringExtra(UPINotificationListenerService.EXTRA_USERNAME) ?: "Supporter"
                val amount = intent.getDoubleExtra(UPINotificationListenerService.EXTRA_AMOUNT, 0.0)
                val app = intent.getStringExtra(UPINotificationListenerService.EXTRA_APP) ?: "UPI"
                val status = intent.getStringExtra(UPINotificationListenerService.EXTRA_STATUS) ?: "Sent ✅"

                val donation = DonationModel(
                    username = username,
                    amount = amount,
                    sourceApp = app,
                    status = status
                )
                adapter.addDonation(donation)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()
        loadPreferences()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        checkNotificationPermission()
        val filter = IntentFilter(UPINotificationListenerService.ACTION_NEW_DONATION)
        registerReceiver(donationReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    override fun onPause() {
        super.onPause()
        try {
            unregisterReceiver(donationReceiver)
        } catch (e: Exception) {
            // Ignored
        }
    }

    private fun setupRecyclerView() {
        adapter = DonationAdapter(donationsList)
        binding.rvDonationLogs.layoutManager = LinearLayoutManager(this)
        binding.rvDonationLogs.adapter = adapter
    }

    private fun checkNotificationPermission() {
        val isGranted = isNotificationServiceEnabled()
        if (isGranted) {
            binding.tvPermissionStatus.text = getString(R.string.permission_granted)
            binding.tvPermissionStatus.setTextColor(ContextCompat.getColor(this, R.color.success))
            binding.btnGrantPermission.text = "Permission Active"
            binding.btnGrantPermission.isEnabled = false
        } else {
            binding.tvPermissionStatus.text = getString(R.string.permission_denied)
            binding.tvPermissionStatus.setTextColor(ContextCompat.getColor(this, R.color.error))
            binding.btnGrantPermission.text = getString(R.string.enable_permission_btn)
            binding.btnGrantPermission.isEnabled = true
        }
    }

    private fun isNotificationServiceEnabled(): Boolean {
        val pkgName = packageName
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(pkgName)
    }

    private fun loadPreferences() {
        val prefs = getSharedPreferences("upi_alert_prefs", Context.MODE_PRIVATE)
        binding.etServerUrl.setText(prefs.getString("server_url", "http://192.168.1.100:3000"))
        binding.etApiToken.setText(prefs.getString("api_token", "upi_stream_secret_123"))
    }

    private fun setupListeners() {
        binding.btnGrantPermission.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        binding.btnSaveConfig.setOnClickListener {
            val url = binding.etServerUrl.text.toString().trim()
            val token = binding.etApiToken.text.toString().trim()

            val prefs = getSharedPreferences("upi_alert_prefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("server_url", url)
                .putString("api_token", token)
                .apply()

            Toast.makeText(this, "Settings Saved! ✅", Toast.LENGTH_SHORT).show()
        }

        binding.btnTestAlert.setOnClickListener {
            val url = binding.etServerUrl.text.toString().trim()
            val token = binding.etApiToken.text.toString().trim()

            val testDonation = DonationModel(
                username = "Aman Sharma",
                amount = 100.0,
                currency = "INR",
                sourceApp = "Google Pay (Test)",
                message = "Love your stream bro! 🔥"
            )

            lifecycleScope.launch {
                Toast.makeText(this@MainActivity, "Sending test alert...", Toast.LENGTH_SHORT).show()
                val success = NetworkClient.sendAlert(this@MainActivity, testDonation, url, token)
                testDonation.status = if (success) "Sent ✅" else "Failed ❌"
                adapter.addDonation(testDonation)

                if (success) {
                    Toast.makeText(this@MainActivity, "Test Alert Sent! Check your overlay.", Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(this@MainActivity, "Failed to connect to server. Check IP & port.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
