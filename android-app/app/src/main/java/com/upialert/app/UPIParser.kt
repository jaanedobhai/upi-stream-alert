package com.upialert.app

import java.util.regex.Pattern

object UPIParser {

    data class ParseResult(
        val username: String,
        val amount: Double,
        val currency: String = "INR",
        val isSuccessfulPayment: Boolean = true
    )

    // Known package identifiers
    const val PKG_GPAY = "com.google.android.apps.nbu.paisa.user"
    const val PKG_PHONEPE = "com.phonepe.app"
    const val PKG_PAYTM = "net.one97.paytm"
    const val PKG_BHIM = "in.org.npci.upiapp"
    const val PKG_CRED = "com.dreamplug.androidapp"
    const val PKG_AMAZON_PAY = "in.amazon.mShop.android.shopping"

    /**
     * Parses notification title and text based on package and returns parsed donation info
     */
    fun parseNotification(packageName: String, title: String?, text: String?): ParseResult? {
        val combined = "${title ?: ""} ${text ?: ""}".trim()
        if (combined.isEmpty()) return null

        // Ignore debit / sent / paid out notifications
        val lower = combined.toLowerCase()
        if (lower.contains("paid to") || lower.contains("debited from") || lower.contains("sent to") || lower.contains("request")) {
            return null
        }

        return when {
            packageName.contains("paisa") || packageName.contains("gpay") -> parseGooglePay(title, text, combined)
            packageName.contains("phonepe") -> parsePhonePe(title, text, combined)
            packageName.contains("paytm") -> parsePaytm(title, text, combined)
            packageName.contains("npci") || packageName.contains("bhim") -> parseBHIM(title, text, combined)
            else -> parseGenericUPI(combined)
        }
    }

    /**
     * Google Pay formats:
     * - "You received ₹500 from Rahul Kumar"
     * - "₹500 received from Rahul"
     * - Title: "Payment received", Text: "Rahul Kumar sent you ₹500"
     */
    private fun parseGooglePay(title: String?, text: String?, combined: String): ParseResult? {
        // Pattern: received ₹?([0-9,.]+) from (.+)
        val p1 = Pattern.compile("received\\s*(?:₹|INR|Rs\\.?)\\s*([0-9,.]+)\\s*from\\s*(.+)", Pattern.CASE_INSENSITIVE)
        val m1 = p1.matcher(combined)
        if (m1.find()) {
            val amount = cleanAmount(m1.group(1)) ?: return null
            val user = cleanName(m1.group(2))
            return ParseResult(username = user, amount = amount)
        }

        // Pattern: (.+) sent you ₹?([0-9,.]+)
        val p2 = Pattern.compile("(.+)\\s*sent you\\s*(?:₹|INR|Rs\\.?)\\s*([0-9,.]+)", Pattern.CASE_INSENSITIVE)
        val m2 = p2.matcher(combined)
        if (m2.find()) {
            val user = cleanName(m2.group(1))
            val amount = cleanAmount(m2.group(2)) ?: return null
            return ParseResult(username = user, amount = amount)
        }

        return parseGenericUPI(combined)
    }

    /**
     * PhonePe formats:
     * - "₹500 received from RAHUL via UPI"
     * - "Payment of ₹500 received from Rahul"
     */
    private fun parsePhonePe(title: String?, text: String?, combined: String): ParseResult? {
        val p1 = Pattern.compile("(?:₹|INR|Rs\\.?)\\s*([0-9,.]+)\\s*received from\\s*([^\\n]+?)(?:\\s+via\\s+UPI|\\.|$)", Pattern.CASE_INSENSITIVE)
        val m1 = p1.matcher(combined)
        if (m1.find()) {
            val amount = cleanAmount(m1.group(1)) ?: return null
            val user = cleanName(m1.group(2))
            return ParseResult(username = user, amount = amount)
        }

        return parseGenericUPI(combined)
    }

    /**
     * Paytm formats:
     * - "Received ₹500 from Rahul Kumar"
     * - "Money Received: ₹500 from Rahul"
     */
    private fun parsePaytm(title: String?, text: String?, combined: String): ParseResult? {
        val p1 = Pattern.compile("(?:received|money received:?)\\s*(?:₹|INR|Rs\\.?)\\s*([0-9,.]+)\\s*from\\s*(.+)", Pattern.CASE_INSENSITIVE)
        val m1 = p1.matcher(combined)
        if (m1.find()) {
            val amount = cleanAmount(m1.group(1)) ?: return null
            val user = cleanName(m1.group(2))
            return ParseResult(username = user, amount = amount)
        }

        return parseGenericUPI(combined)
    }

    /**
     * BHIM formats:
     * - "Rs. 500 credited by UPI from Rahul"
     */
    private fun parseBHIM(title: String?, text: String?, combined: String): ParseResult? {
        return parseGenericUPI(combined)
    }

    /**
     * Generic UPI & Bank SMS fallback parser
     */
    fun parseGenericUPI(text: String): ParseResult? {
        val lower = text.toLowerCase()
        if (!lower.contains("credited") && !lower.contains("received") && !lower.contains("sent you")) {
            return null
        }

        // Amount regex: ₹ / Rs / INR followed by digits
        val amountPattern = Pattern.compile("(?:₹|INR|Rs\\.?)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)", Pattern.CASE_INSENSITIVE)
        val amountMatcher = amountPattern.matcher(text)
        if (!amountMatcher.find()) return null

        val amount = cleanAmount(amountMatcher.group(1)) ?: return null

        // Try extracting sender after "from" or "by"
        var username = "UPI Supporter"
        val fromPattern = Pattern.compile("(?:from|by)\\s+([A-Za-z0-9\\s]{2,30}?)(?:\\s+on|\\s+via|\\s+ref|\\s+UPI|\\.|$)", Pattern.CASE_INSENSITIVE)
        val fromMatcher = fromPattern.matcher(text)
        if (fromMatcher.find()) {
            val candidate = cleanName(fromMatcher.group(1))
            if (candidate.isNotEmpty() && candidate.length > 2 && !candidate.toLowerCase().contains("bank") && !candidate.toLowerCase().contains("account")) {
                username = candidate
            }
        }

        return ParseResult(username = username, amount = amount)
    }

    private fun cleanAmount(raw: String?): Double? {
        if (raw.isNullOrEmpty()) return null
        return try {
            raw.replace(",", "").toDouble()
        } catch (e: Exception) {
            null
        }
    }

    private fun cleanName(raw: String?): String {
        if (raw.isNullOrEmpty()) return "Anonymous"
        var cleaned = raw.trim()
            .replace(Regex("(?i)\\s+via\\s+.*"), "")
            .replace(Regex("(?i)\\s+UPI.*"), "")
            .replace(Regex("(?i)\\s+ref.*"), "")
            .replace(Regex("[.,;!]$"), "")
            .trim()
        
        // Capitalize words nicely
        return cleaned.split(" ").filter { it.isNotEmpty() }.joinToString(" ") { word ->
            word.capitalize()
        }
    }
}
