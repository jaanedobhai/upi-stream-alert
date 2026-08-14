package com.upialert.app

import com.google.gson.annotations.SerializedName

data class DonationModel(
    @SerializedName("id")
    val id: String = "upi_" + System.currentTimeMillis(),
    
    @SerializedName("username")
    val username: String,
    
    @SerializedName("amount")
    val amount: Double,
    
    @SerializedName("currency")
    val currency: String = "INR",
    
    @SerializedName("sourceApp")
    val sourceApp: String,
    
    @SerializedName("rawText")
    val rawText: String = "",
    
    @SerializedName("message")
    val message: String = "",
    
    @SerializedName("timestamp")
    val timestamp: Long = System.currentTimeMillis(),
    
    var status: String = "Pending"
)
