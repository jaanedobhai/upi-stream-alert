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
    const val PKG_BHIM = "in.org.npci.upiapp"
    const val PKG_GPAY = "com.google.android.apps.nbu.paisa.user"
    const val PKG_PHONEPE = "com.phonepe.app"
    const val PKG_PAYTM = "net.one97.paytm"
    const val PKG_CRED = "com.dreamplug.androidapp"

    fun parseNotification(packageName: String, title: String?, text: String?): ParseResult? {
        val combined = "${title ?: ""} ${text ?: ""}".trim()
        if (combined.isEmpty()) return null

        // Ignore outgoing / debit / request messages
        val lower = combined.toLowerCase()
        if (lower.contains("paid to") || lower.contains("debited from") || lower.contains("sent to") || 
            lower.contains("requested money") || lower.contains("payment request") || lower.contains("bill due")) {
            return null
        }

        // 1. Try BHIM specific parser
        val bhimResult = parseBHIM(combined)
        if (bhimResult != null) return bhimResult

        // 2. Try Google Pay
        val gpayResult = parseGooglePay(combined)
        if (gpayResult != null) return gpayResult

        // 3. Try PhonePe
        val phonePeResult = parsePhonePe(combined)
        if (phonePeResult != null) return phonePeResult

        // 4. Try Paytm
        val paytmResult = parsePaytm(combined)
        if (paytmResult != null) return paytmResult

        // 5. Try General Robust UPI / Bank SMS pattern
        return parseGenericUPI(combined)
    }

    /**
     * BHIM:
     * - "Received INR 100.00 in your State Bank Of India account(XX0614) from RAJUALIKHAN (rjkhan@upi). For further details..."
     * - "Received Rs. 500.00 from RAJUALIKHAN"
     */
    private fun parseBHIM(combined: String): ParseResult? {
        // Pattern: Received (INR|₹|Rs) (amount) in your ... from (NAME) ((VPA))
        val p1 = Pattern.compile("(?:received|credited)\\s*(?:INR|₹|Rs\\.?)\\s*([0-9,.]+).*?\\s+from\\s+([A-Za-z0-9\\s_]+?)(?:\\s*\\(|\\.|\\s+on|\\s+via|\\s*$)", Pattern.CASE_INSENSITIVE)
        val m1 = p1.matcher(combined)
        if (m1.find()) {
            val amount = cleanAmount(m1.group(1)) ?: return null
            val user = cleanName(m1.group(2))
            return ParseResult(username = user, amount = amount)
        }

        // Pattern: (NAME) sent you (INR|₹|Rs) (amount)
        val p2 = Pattern.compile("([A-Za-z0-9\\s_]+?)\\s+sent you\\s*(?:INR|₹|Rs\\.?)\\s*([0-9,.]+)", Pattern.CASE_INSENSITIVE)
        val m2 = p2.matcher(combined)
        if (m2.find()) {
            val user = cleanName(m2.group(1))
            val amount = cleanAmount(m2.group(2)) ?: return null
            return ParseResult(username = user, amount = amount)
        }

        return null
    }

    /**
     * Google Pay:
     * - "You received ₹100 from Rahul Kumar"
     * - "Rahul Kumar sent you ₹100"
     */
    private fun parseGooglePay(combined: String): ParseResult? {
        val p1 = Pattern.compile("received\\s*(?:₹|INR|Rs\\.?)\\s*([0-9,.]+)\\s*from\\s*([A-Za-z0-9\\s]+?)(?:\\s*\\(|\\.|\\s+on|\\s+via|\\s*$)", Pattern.CASE_INSENSITIVE)
        val m1 = p1.matcher(combined)
        if (m1.find()) {
            val amount = cleanAmount(m1.group(1)) ?: return null
            val user = cleanName(m1.group(2))
            return ParseResult(username = user, amount = amount)
        }

        val p2 = Pattern.compile("([A-Za-z0-9\\s]+?)\\s*sent you\\s*(?:₹|INR|Rs\\.?)\\s*([0-9,.]+)", Pattern.CASE_INSENSITIVE)
        val m2 = p2.matcher(combined)
        if (m2.find()) {
            val user = cleanName(m2.group(1))
            val amount = cleanAmount(m2.group(2)) ?: return null
            return ParseResult(username = user, amount = amount)
        }

        return null
    }

    /**
     * PhonePe:
     * - "₹100 received from RAHUL via UPI"
     * - "Payment of ₹100 received from Rahul"
     */
    private fun parsePhonePe(combined: String): ParseResult? {
        val p1 = Pattern.compile("(?:₹|INR|Rs\\.?)\\s*([0-9,.]+)\\s*received from\\s*([A-Za-z0-9\\s]+?)(?:\\s*\\(|\\s+via|\\.|\\s*$)", Pattern.CASE_INSENSITIVE)
        val m1 = p1.matcher(combined)
        if (m1.find()) {
            val amount = cleanAmount(m1.group(1)) ?: return null
            val user = cleanName(m1.group(2))
            return ParseResult(username = user, amount = amount)
        }

        return null
    }

    /**
     * Paytm:
     * - "Received ₹100 from Rahul Kumar"
     * - "Money Received: ₹100 from Rahul"
     */
    private fun parsePaytm(combined: String): ParseResult? {
        val p1 = Pattern.compile("(?:received|money received:?)\\s*(?:₹|INR|Rs\\.?)\\s*([0-9,.]+)\\s*from\\s*([A-Za-z0-9\\s]+?)(?:\\s*\\(|\\.|\\s*$)", Pattern.CASE_INSENSITIVE)
        val m1 = p1.matcher(combined)
        if (m1.find()) {
            val amount = cleanAmount(m1.group(1)) ?: return null
            val user = cleanName(m1.group(2))
            return ParseResult(username = user, amount = amount)
        }

        return null
    }

    /**
     * Generic UPI & Bank SMS Fallback
     */
    fun parseGenericUPI(text: String): ParseResult? {
        val lower = text.toLowerCase()
        if (!lower.contains("credited") && !lower.contains("received") && !lower.contains("sent you")) {
            return null
        }

        // Amount regex
        val amountPattern = Pattern.compile("(?:₹|INR|Rs\\.?)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)", Pattern.CASE_INSENSITIVE)
        val amountMatcher = amountPattern.matcher(text)
        if (!amountMatcher.find()) return null

        val amount = cleanAmount(amountMatcher.group(1)) ?: return null

        // Try extracting sender
        var username = "UPI Supporter"
        val fromPattern = Pattern.compile("(?:from|by)\\s+([A-Za-z0-9\\s]{2,30}?)(?:\\s*\\(|\\s+on|\\s+via|\\s+ref|\\s+UPI|\\.|$)", Pattern.CASE_INSENSITIVE)
        val fromMatcher = fromPattern.matcher(text)
        if (fromMatcher.find()) {
            val candidate = cleanName(fromMatcher.group(1))
            if (candidate.isNotEmpty() && candidate.length > 2 && 
                !candidate.toLowerCase().contains("bank") && 
                !candidate.toLowerCase().contains("account") &&
                !candidate.toLowerCase().contains("state bank")) {
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
            .replace(Regex("(?i)\\s*\\(.*\\)"), "") // Remove parentheses like (rjkhan@upi)
            .replace(Regex("(?i)\\s+via\\s+.*"), "")
            .replace(Regex("(?i)\\s+UPI.*"), "")
            .replace(Regex("(?i)\\s+ref.*"), "")
            .replace(Regex("[.,;!_\\-+]"), " ")
            .trim()

        if (cleaned.isEmpty()) return "UPI Supporter"

        // Handle PascalCase / CamelCase (e.g. RajuAliKhan -> Raju Ali Khan)
        cleaned = cleaned.replace(Regex("([a-z])([A-Z])"), "$1 $2")
            .replace(Regex("([A-Z]+)([A-Z][a-z])"), "$1 $2")

        // If name already contains spaces, format as Title Case
        if (cleaned.contains(" ")) {
            return cleaned.split("\\s+".toRegex()).filter { it.isNotEmpty() }.joinToString(" ") { word ->
                if (word.length <= 1) word.toUpperCase()
                else word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase()
            }
        }

        // Universal dictionary tokenizer for unspaced compound names
        val lower = cleaned.toLowerCase()
        val dict = setOf(
            "sharma", "verma", "gupta", "singh", "kumar", "khan", "patel", "yadav", "mishra", "pandey", "tiwari", 
            "dubey", "shukla", "tripathi", "pathak", "chaubey", "dwivedi", "jha", "mandal", "paswan", "thakur", 
            "chaudhary", "choudhury", "malik", "mallick", "ansari", "ahmed", "ahmad", "hussain", "husain", "sheikh", 
            "shaikh", "alam", "raza", "khatun", "khatoon", "parveen", "begum", "siddiqui", "bano", "akhtar", 
            "shah", "jain", "agarwal", "agrawal", "mittal", "bansal", "goyal", "saxena", "bhatnagar", "srivastava", 
            "mathur", "kulshrestha", "rastogi", "nigam", "sinha", "ghosh", "mukherjee", "banerjee", "chatterjee", 
            "ganguly", "bhattacharya", "pal", "chandra", "dutta", "chakraborty", "mitra", "sengupta", "dasgupta", 
            "majumdar", "bhowmick", "saha", "halder", "barman", "paul", "biswas", "roy", "ray", "sarkar", "mondal", 
            "adiga", "rao", "murthy", "hegde", "bhat", "shetty", "rai", "gowda", "naidu", "chowdary", "reddy", 
            "nair", "pillai", "menon", "kurup", "panicker", "nambiar", "iyer", "iyengar", "deshmukh", "patil", 
            "pawar", "kadam", "shinde", "gaikwad", "chavan", "more", "salunkhe", "jadhav", "bhosale", "sawant", 
            "kohli", "pandya", "gill", "jaiswal", "pant", "dhoni", "rahane", "pujara", "ashwin", "bumrah", "shami", 
            "siraj", "kuldeep", "chahal", "tewatia", "samson", "kishan", "rathi", "badoni", "varma", "mehta", 
            "joshi", "bose", "kaur", "devi", "prasad", "prakash", "narayan", "swamy", "swami", "nathan", "mani",
            "ali", "kumar", "singh", "raj", "chand", "chandra", "nath", "kant", "lal", "ram", "dev", "das", "pal", 
            "deep", "preet", "meet", "jeet", "inder", "ender", "wati", "rani", "sen",
            "raju", "rahul", "amit", "rohit", "mohd", "md", "syed", "aman", "vikas", "vikram", "priya", "neha", 
            "pooja", "anil", "sunil", "deepak", "sanjay", "ajay", "vijay", "rajesh", "suresh", "manoj", "dinesh", 
            "santosh", "pankaj", "ashok", "mukesh", "kamlesh", "sachin", "vinod", "dhanraj", "harsh", "harshit", 
            "ankit", "tarun", "sahil", "akash", "abhishek", "ayush", "sourabh", "saurabh", "shivam", "subhash", 
            "prashant", "gaurav", "mayank", "kunal", "nikhil", "vivek", "mayur", "alok", "arun", "varun", "karan", 
            "chetan", "naveen", "praveen", "rakesh", "naresh", "mahesh", "umesh", "hemant", "jay", "dev", "ram", 
            "krishna", "radhe", "gopal", "govind", "madhav", "vishnu", "shiva", "ganesh", "surya", "om", "arif", 
            "asif", "salman", "aamir", "amir", "shahrukh", "irfan", "farhan", "zaheer", "wasim", "danish", "adnan", 
            "faizan", "sohail", "suhail", "sameer", "samir", "rizwan", "nadeem", "imran", "tariq", "zubair", 
            "rehan", "virat", "hardik", "rishabh", "shubman", "yashasvi", "sanju", "ishan", "jasprit", "mohammed"
        )

        for (i in 3..(lower.length - 3)) {
            val p1 = lower.substring(0, i)
            val rest = lower.substring(i)

            // 3 parts
            for (j in 2..(rest.length - 2)) {
                val p2 = rest.substring(0, j)
                val p3 = rest.substring(j)
                if (dict.contains(p1) && dict.contains(p2) && dict.contains(p3)) {
                    return listOf(p1, p2, p3).joinToString(" ") { it.capitalize() }
                }
            }

            // 2 parts
            if (dict.contains(p1) && dict.contains(rest)) {
                return listOf(p1, rest).joinToString(" ") { it.capitalize() }
            }
        }

        // Fallback: Title case single word
        return cleaned.substring(0, 1).toUpperCase() + cleaned.substring(1).toLowerCase()
    }
}
