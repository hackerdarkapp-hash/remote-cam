package com.remotecam

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.os.IBinder
import android.util.Base64
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.*
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class StreamingService : Service(), LifecycleOwner {

    companion object {
        const val ACTION_START = "com.remotecam.START"
        const val ACTION_STOP  = "com.remotecam.STOP"
        const val EXTRA_ROOM_ID    = "room_id"
        const val EXTRA_SERVER_URL = "server_url"
        const val CHANNEL_ID      = "remotecam_stream"
        const val NOTIFICATION_ID  = 7001
        const val PREFS            = "remotecam_prefs"
        private const val TAG              = "RemoteCamService"
        private const val FRAME_INTERVAL_MS = 120L
    }

    private val lifecycleRegistry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry

    private var socket: Socket? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val isStreaming = AtomicBoolean(false)
    private var lastFrameTime = 0L
    private var currentRoomId = ""

    override fun onCreate() {
        super.onCreate()
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
        lifecycleRegistry.currentState = Lifecycle.State.STARTED
        createNotificationChannel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return when (intent?.action) {
            ACTION_START -> {
                val roomId    = intent.getStringExtra(EXTRA_ROOM_ID)    ?: run { stopSelf(); return START_NOT_STICKY }
                val serverUrl = intent.getStringExtra(EXTRA_SERVER_URL) ?: run { stopSelf(); return START_NOT_STICKY }
                startStream(roomId, serverUrl)
                START_STICKY
            }
            ACTION_STOP -> { stopStream(); START_NOT_STICKY }
            else -> START_NOT_STICKY
        }
    }

    private fun createNotificationChannel() {
        val ch = NotificationChannel(CHANNEL_ID, "Live Stream", NotificationManager.IMPORTANCE_LOW).apply {
            description = "RemoteCam background streaming"
            setShowBadge(false)
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
    }

    private fun buildNotification(roomId: String): Notification {
        val stopPi = PendingIntent.getService(
            this, 0,
            Intent(this, StreamingService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openPi = openIntent?.let {
            PendingIntent.getActivity(this, 1, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle("RemoteCam — LIVE")
            .setContentText("Room: $roomId  •  Tap to open")
            .setOngoing(true)
            .setContentIntent(openPi)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopPi)
            .build()
    }

    private fun startStream(roomId: String, serverUrl: String) {
        currentRoomId = roomId
        isStreaming.set(true)
        startForeground(NOTIFICATION_ID, buildNotification(roomId))

        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("room_id", roomId)
            .putString("server_url", serverUrl)
            .putBoolean("was_streaming", true)
            .apply()

        connectSocket(serverUrl, roomId)
        startCamera()
    }

    private fun connectSocket(serverUrl: String, roomId: String) {
        try {
            val opts = IO.Options.builder()
                .setPath("/api/socket.io/")
                .setTransports(arrayOf("websocket", "polling"))
                .setReconnection(true)
                .setReconnectionDelay(1000)
                .build()
            socket = IO.socket(serverUrl, opts)
            socket?.on(Socket.EVENT_CONNECT) {
                socket?.emit("camera-join", JSONObject().put("roomId", roomId))
                Log.d(TAG, "Socket connected — room $roomId")
            }
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Socket error", e)
        }
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener(
            {
                try {
                    cameraProvider = future.get()
                    val analysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                        .build()

                    analysis.setAnalyzer(cameraExecutor) { proxy -> processFrame(proxy) }

                    cameraProvider?.unbindAll()
                    cameraProvider?.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, analysis)
                    Log.d(TAG, "Camera started")
                } catch (e: Exception) {
                    Log.e(TAG, "Camera start error", e)
                }
            },
            ContextCompat.getMainExecutor(this)
        )
    }

    private fun processFrame(proxy: ImageProxy) {
        try {
            if (!isStreaming.get()) { proxy.close(); return }
            val now = System.currentTimeMillis()
            if (now - lastFrameTime < FRAME_INTERVAL_MS) { proxy.close(); return }
            if (socket?.connected() != true) { proxy.close(); return }
            lastFrameTime = now

            val yPlane = proxy.planes[0]
            val uPlane = proxy.planes[1]
            val vPlane = proxy.planes[2]

            val yBuf = yPlane.buffer
            val uBuf = uPlane.buffer
            val vBuf = vPlane.buffer

            val ySize = yBuf.remaining()
            val uSize = uBuf.remaining()
            val vSize = vBuf.remaining()

            val nv21 = ByteArray(ySize + uSize + vSize)
            yBuf.get(nv21, 0, ySize)
            vBuf.get(nv21, ySize, vSize)
            uBuf.get(nv21, ySize + vSize, uSize)

            val yuvImg = YuvImage(nv21, ImageFormat.NV21, proxy.width, proxy.height, null)
            val out = ByteArrayOutputStream()
            yuvImg.compressToJpeg(Rect(0, 0, proxy.width, proxy.height), 30, out)
            val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)

            socket?.emit("frame", JSONObject().put("roomId", currentRoomId).put("frame", base64))
        } catch (e: Exception) {
            Log.e(TAG, "Frame error", e)
        } finally {
            proxy.close()
        }
    }

    private fun stopStream() {
        isStreaming.set(false)
        cameraProvider?.unbindAll()
        cameraProvider = null
        socket?.disconnect()
        socket = null
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("was_streaming", false)
            .apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        isStreaming.set(false)
        cameraProvider?.unbindAll()
        cameraExecutor.shutdown()
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        super.onDestroy()
    }
}
