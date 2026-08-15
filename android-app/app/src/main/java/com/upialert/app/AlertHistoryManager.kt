package com.upialert.app

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object AlertHistoryManager {

    private const val PREFS_NAME = "upi_alert_history_prefs"
    private const val KEY_HISTORY = "alert_history_list"
    private val gson = Gson()

    @Synchronized
    fun getHistory(context: Context): MutableList<DonationModel> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_HISTORY, null) ?: return mutableListOf()
        return try {
            val type = object : TypeToken<MutableList<DonationModel>>() {}.type
            gson.fromJson(json, type) ?: mutableListOf()
        } catch (e: Exception) {
            mutableListOf()
        }
    }

    @Synchronized
    fun addAlert(context: Context, donation: DonationModel) {
        val list = getHistory(context)
        // Insert newest at the top
        list.add(0, donation)
        // Keep up to 200 items in history
        if (list.size > 200) {
            list.removeAt(list.size - 1)
        }
        saveHistory(context, list)
    }

    @Synchronized
    fun updateAlertStatus(context: Context, id: String, status: String) {
        val list = getHistory(context)
        val item = list.find { it.id == id }
        if (item != null) {
            item.status = status
            saveHistory(context, list)
        }
    }

    @Synchronized
    fun clearHistory(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_HISTORY).apply()
    }

    private fun saveHistory(context: Context, list: List<DonationModel>) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = gson.toJson(list)
        prefs.edit().putString(KEY_HISTORY, json).apply()
    }
}
