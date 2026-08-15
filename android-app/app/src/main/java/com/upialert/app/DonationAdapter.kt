package com.upialert.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DonationAdapter(private val items: MutableList<DonationModel>) :
    RecyclerView.Adapter<DonationAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatarInitial: TextView = view.findViewById(R.id.tvLogAvatarInitial)
        val tvUser: TextView = view.findViewById(R.id.tvLogUser)
        val tvApp: TextView = view.findViewById(R.id.tvLogApp)
        val tvTime: TextView = view.findViewById(R.id.tvLogTime)
        val tvAmount: TextView = view.findViewById(R.id.tvLogAmount)
        val tvStatus: TextView = view.findViewById(R.id.tvLogStatus)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_donation_log, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        
        val initial = if (item.username.isNotBlank()) item.username.trim().take(1).toUpperCase(Locale.ROOT) else "U"
        holder.tvAvatarInitial.text = initial
        holder.tvUser.text = item.username
        holder.tvApp.text = item.sourceApp
        holder.tvTime.text = formatTime(item.timestamp)
        holder.tvAmount.text = "₹${Math.round(item.amount)}"
        
        holder.tvStatus.text = item.status
        if (item.status.contains("Sent") || item.status.contains("Success") || item.status.contains("✅")) {
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.context, R.color.success))
        } else {
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.context, R.color.error))
        }
    }

    override fun getItemCount(): Int = items.size

    fun addDonation(donation: DonationModel) {
        items.add(0, donation)
        notifyItemInserted(0)
    }

    fun setItems(newItems: List<DonationModel>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    fun clearAll() {
        items.clear()
        notifyDataSetChanged()
    }

    private fun formatTime(timestamp: Long): String {
        val diff = (System.currentTimeMillis() - timestamp) / 1000
        return when {
            diff < 60 -> "Just now"
            diff < 3600 -> "${diff / 60}m ago"
            diff < 86400 -> "${diff / 3600}h ago"
            else -> {
                val sdf = SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault())
                sdf.format(Date(timestamp))
            }
        }
    }
}
