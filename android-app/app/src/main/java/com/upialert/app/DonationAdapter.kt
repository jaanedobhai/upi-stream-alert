package com.upialert.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView

class DonationAdapter(private val items: MutableList<DonationModel>) :
    RecyclerView.Adapter<DonationAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvAmount: TextView = view.findViewById(R.id.tvLogAmount)
        val tvUser: TextView = view.findViewById(R.id.tvLogUser)
        val tvApp: TextView = view.findViewById(R.id.tvLogApp)
        val tvStatus: TextView = view.findViewById(R.id.tvLogStatus)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_donation_log, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvAmount.text = "₹${item.amount.toInt()}"
        holder.tvUser.text = item.username
        holder.tvApp.text = "${item.sourceApp} • ${formatTime(item.timestamp)}"
        
        holder.tvStatus.text = item.status
        if (item.status.contains("Sent") || item.status.contains("Success")) {
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

    private fun formatTime(timestamp: Long): String {
        val diff = (System.currentTimeMillis() - timestamp) / 1000
        return when {
            diff < 60 -> "Just now"
            diff < 3600 -> "${diff / 60}m ago"
            else -> "${diff / 3600}h ago"
        }
    }
}
