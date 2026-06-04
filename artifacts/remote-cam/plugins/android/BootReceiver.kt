package com.remotecam

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "RemoteCamBoot"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val validActions = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.MY_PACKAGE_REPLACED",
            "android.intent.action.LOCKED_BOOT_COMPLETED"
        )
        if (action !in validActions) return

        val prefs = context.getSharedPreferences(StreamingService.PREFS, Context.MODE_PRIVATE)
        val wasStreaming   = prefs.getBoolean("was_streaming", false)
        val autoStartEnabled = prefs.getBoolean("auto_start_enabled", false)
        val roomId         = prefs.getString("room_id", null)
        val serverUrl      = prefs.getString("server_url", null)

        if (wasStreaming && autoStartEnabled && roomId != null && serverUrl != null) {
            Log.d(TAG, "Auto-starting stream for room $roomId")
            val svc = Intent(context, StreamingService::class.java).apply {
                this.action = StreamingService.ACTION_START
                putExtra(StreamingService.EXTRA_ROOM_ID, roomId)
                putExtra(StreamingService.EXTRA_SERVER_URL, serverUrl)
            }
            context.startForegroundService(svc)
        } else {
            Log.d(TAG, "Boot received — auto-start skipped (wasStreaming=$wasStreaming, autoStart=$autoStartEnabled)")
        }
    }
}
