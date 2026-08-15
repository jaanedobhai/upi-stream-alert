package com.upialert.app

import android.app.Dialog
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.upialert.app.databinding.ActivityMainBinding
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: DonationAdapter
    private val donationsList = mutableListOf<DonationModel>()
    private var isSettingsExpanded = false

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
                updateHistoryCount()
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
        loadHistoryFromStorage()
        startListenerService()
    }

    private fun startListenerService() {
        try {
            val serviceIntent = Intent(this, UPINotificationListenerService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            // Ignored if system handles binding
        }
    }

    override fun onResume() {
        super.onResume()
        checkNotificationPermission()
        val filter = IntentFilter(UPINotificationListenerService.ACTION_NEW_DONATION)
        registerReceiver(donationReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        loadHistoryFromStorage()
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

    private fun loadHistoryFromStorage() {
        val savedList = AlertHistoryManager.getHistory(this)
        adapter.setItems(savedList)
        updateHistoryCount()
    }

    private fun updateHistoryCount() {
        val count = adapter.itemCount
        binding.tvHistoryCount.text = "$count"
        if (count == 0) {
            binding.tvEmptyHistory.visibility = View.VISIBLE
            binding.rvDonationLogs.visibility = View.GONE
        } else {
            binding.tvEmptyHistory.visibility = View.GONE
            binding.rvDonationLogs.visibility = View.VISIBLE
        }
    }

    private fun checkNotificationPermission() {
        val isGranted = isNotificationServiceEnabled()
        if (isGranted) {
            binding.cardPermission.visibility = View.GONE
            binding.tvLiveStatus.text = "Listener Active 🟢"
            binding.tvLiveStatus.setTextColor(ContextCompat.getColor(this, R.color.primary))
            binding.dotStatus.backgroundTintList = ContextCompat.getColorStateList(this, R.color.primary)
        } else {
            binding.cardPermission.visibility = View.VISIBLE
            binding.tvPermissionStatus.text = "⚠️ Notification Access Required for Live Alerts"
            binding.tvPermissionStatus.setTextColor(ContextCompat.getColor(this, R.color.warning))
            binding.tvLiveStatus.text = "Listener Inactive ⚠️"
            binding.tvLiveStatus.setTextColor(ContextCompat.getColor(this, R.color.warning))
            binding.dotStatus.backgroundTintList = ContextCompat.getColorStateList(this, R.color.warning)
        }
    }

    private fun isNotificationServiceEnabled(): Boolean {
        val pkgName = packageName
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(pkgName)
    }

    private fun loadPreferences() {
        val prefs = getSharedPreferences("upi_alert_prefs", Context.MODE_PRIVATE)
        binding.etServerUrl.setText(prefs.getString("server_url", "https://ntfy.sh/upi_alert_jaanedobhai_live"))
        binding.etApiToken.setText(prefs.getString("api_token", "upi_stream_secret_123"))
    }

    private fun setupListeners() {
        // Permission Action
        binding.btnGrantPermission.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        // Collapsible Accordion Toggle
        binding.headerServerSettings.setOnClickListener {
            isSettingsExpanded = !isSettingsExpanded
            if (isSettingsExpanded) {
                binding.layoutSettingsExpandable.visibility = View.VISIBLE
                binding.tvSettingsChevron.text = "▲"
            } else {
                binding.layoutSettingsExpandable.visibility = View.GONE
                binding.tvSettingsChevron.text = "▼"
            }
        }

        // Save Settings Action
        binding.btnSaveConfig.setOnClickListener {
            val url = binding.etServerUrl.text.toString().trim()
            val token = binding.etApiToken.text.toString().trim()

            val prefs = getSharedPreferences("upi_alert_prefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("server_url", url)
                .putString("api_token", token)
                .apply()

            Toast.makeText(this, "Settings Saved! ✅", Toast.LENGTH_SHORT).show()
            // Collapse after saving
            binding.layoutSettingsExpandable.visibility = View.GONE
            binding.tvSettingsChevron.text = "▼"
            isSettingsExpanded = false
        }

        // Quick Test Alert (₹100)
        binding.btnQuickTest.setOnClickListener {
            fireTestAlert(username = "Raju Ali Khan", amount = 100.0, sourceApp = "BHIM UPI")
        }

        // Custom Test Alert Modal
        binding.btnCustomTest.setOnClickListener {
            showCustomTestAlertDialog()
        }

        // Clear History Action
        binding.btnClearHistory.setOnClickListener {
            if (adapter.itemCount == 0) return@setOnClickListener

            AlertDialog.Builder(this)
                .setTitle("Clear Alert History")
                .setMessage("Are you sure you want to clear all alert logs from history?")
                .setPositiveButton("Clear") { _, _ ->
                    AlertHistoryManager.clearHistory(this)
                    adapter.clearAll()
                    updateHistoryCount()
                    Toast.makeText(this, "History cleared.", Toast.LENGTH_SHORT).show()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun showCustomTestAlertDialog() {
        val dialog = Dialog(this)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(R.layout.dialog_custom_test_alert)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )

        val etName = dialog.findViewById<TextInputEditText>(R.id.etCustomName)
        val etAmount = dialog.findViewById<TextInputEditText>(R.id.etCustomAmount)
        val btnClose = dialog.findViewById<TextView>(R.id.btnDialogClose)
        val btnSend = dialog.findViewById<MaterialButton>(R.id.btnSendCustomAlert)

        // Amount Chips
        val chip10 = dialog.findViewById<TextView>(R.id.chipAmount10)
        val chip50 = dialog.findViewById<TextView>(R.id.chipAmount50)
        val chip100 = dialog.findViewById<TextView>(R.id.chipAmount100)
        val chip500 = dialog.findViewById<TextView>(R.id.chipAmount500)
        val chip1000 = dialog.findViewById<TextView>(R.id.chipAmount1000)

        fun selectChip(selectedChip: TextView, amount: String) {
            listOf(chip10, chip50, chip100, chip500, chip1000).forEach { chip ->
                chip.setBackgroundResource(R.drawable.bg_pill_chip)
                chip.setTextColor(ContextCompat.getColor(this, R.color.text_primary))
            }
            selectedChip.setBackgroundResource(R.drawable.bg_amount_pill)
            selectedChip.setTextColor(ContextCompat.getColor(this, R.color.primary))
            etAmount.setText(amount)
        }

        chip10.setOnClickListener { selectChip(chip10, "10") }
        chip50.setOnClickListener { selectChip(chip50, "50") }
        chip100.setOnClickListener { selectChip(chip100, "100") }
        chip500.setOnClickListener { selectChip(chip500, "500") }
        chip1000.setOnClickListener { selectChip(chip1000, "1000") }

        // Source App Chips
        val appBhim = dialog.findViewById<TextView>(R.id.chipAppBhim)
        val appGpay = dialog.findViewById<TextView>(R.id.chipAppGpay)
        val appPhonePe = dialog.findViewById<TextView>(R.id.chipAppPhonePe)
        val appPaytm = dialog.findViewById<TextView>(R.id.chipAppPaytm)

        var selectedApp = "BHIM UPI"

        fun selectApp(selectedView: TextView, appName: String) {
            listOf(appBhim, appGpay, appPhonePe, appPaytm).forEach { view ->
                view.setBackgroundResource(R.drawable.bg_pill_chip)
                view.setTextColor(ContextCompat.getColor(this, R.color.text_primary))
            }
            selectedView.setBackgroundResource(R.drawable.bg_amount_pill)
            selectedView.setTextColor(ContextCompat.getColor(this, R.color.primary))
            selectedApp = appName
        }

        appBhim.setOnClickListener { selectApp(appBhim, "BHIM UPI") }
        appGpay.setOnClickListener { selectApp(appGpay, "Google Pay") }
        appPhonePe.setOnClickListener { selectApp(appPhonePe, "PhonePe") }
        appPaytm.setOnClickListener { selectApp(appPaytm, "Paytm") }

        btnClose.setOnClickListener { dialog.dismiss() }

        btnSend.setOnClickListener {
            val name = etName.text.toString().trim().ifEmpty { "Raju Ali Khan" }
            val amountStr = etAmount.text.toString().trim().ifEmpty { "100" }
            val amount = amountStr.toDoubleOrNull() ?: 100.0

            dialog.dismiss()
            fireTestAlert(username = name, amount = amount, sourceApp = selectedApp)
        }

        dialog.show()
    }

    private fun fireTestAlert(username: String, amount: Double, sourceApp: String) {
        val prefs = getSharedPreferences("upi_alert_prefs", Context.MODE_PRIVATE)
        val url = prefs.getString("server_url", "https://ntfy.sh/upi_alert_jaanedobhai_live") ?: "https://ntfy.sh/upi_alert_jaanedobhai_live"
        val token = prefs.getString("api_token", "upi_stream_secret_123") ?: "upi_stream_secret_123"

        val testDonation = DonationModel(
            username = username,
            amount = amount,
            currency = "INR",
            sourceApp = sourceApp,
            message = ""
        )

        // 1. Immediately persist locally
        AlertHistoryManager.addAlert(this, testDonation)
        adapter.addDonation(testDonation)
        updateHistoryCount()

        // 2. Dispatch to cloud
        lifecycleScope.launch {
            Toast.makeText(this@MainActivity, "⚡ Firing Test Alert (₹${Math.round(amount)})...", Toast.LENGTH_SHORT).show()
            val success = NetworkClient.sendAlert(this@MainActivity, testDonation, url, token)
            testDonation.status = if (success) "Sent ✅" else "Failed ❌"
            AlertHistoryManager.updateAlertStatus(this@MainActivity, testDonation.id, testDonation.status)
            adapter.notifyDataSetChanged()

            if (success) {
                Toast.makeText(this@MainActivity, "Test Alert Sent! Check your overlay.", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this@MainActivity, "Failed to connect to cloud endpoint.", Toast.LENGTH_LONG).show()
            }
        }
    }
}
