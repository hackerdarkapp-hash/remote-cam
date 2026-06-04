package com.remotecam

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*

class StreamingModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "StreamingModule"

    @ReactMethod
    fun startStreaming(roomId: String, serverUrl: String) {
        val svc = Intent(reactContext, StreamingService::class.java).apply {
            action = StreamingService.ACTION_START
            putExtra(StreamingService.EXTRA_ROOM_ID, roomId)
            putExtra(StreamingService.EXTRA_SERVER_URL, serverUrl)
        }
        reactContext.startForegroundService(svc)
    }

    @ReactMethod
    fun stopStreaming() {
        val svc = Intent(reactContext, StreamingService::class.java).apply {
            action = StreamingService.ACTION_STOP
        }
        reactContext.startService(svc)
    }

    @ReactMethod
    fun setAutoStart(enabled: Boolean) {
        reactContext.getSharedPreferences(StreamingService.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("auto_start_enabled", enabled)
            .apply()
    }

    @ReactMethod
    fun getAutoStart(promise: Promise) {
        val enabled = reactContext.getSharedPreferences(StreamingService.PREFS, Context.MODE_PRIVATE)
            .getBoolean("auto_start_enabled", false)
        promise.resolve(enabled)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
