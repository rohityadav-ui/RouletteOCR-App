package com.roulette.ocrpredictor.service

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.roulette.ocrpredictor.R
import com.roulette.ocrpredictor.model.RouletteNumber
import com.roulette.ocrpredictor.ocr.DuplicateFrameFilter
import kotlinx.coroutines.*
import java.nio.ByteBuffer
import java.util.regex.Pattern

/**
 * Foreground Service utilizing MediaProjection API to capture live casino streams
 * and process real-time frames using Google ML Kit Text Recognition with duplicate
 * frame filtering.
 */
class ScreenCaptureService : Service() {

    companion object {
        private const val TAG = "ScreenCaptureService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "ROULETTE_OCR_CHANNEL"

        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"

        var instance: ScreenCaptureService? = null
            private set
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null

    private lateinit var textRecognizer: TextRecognizer
    private val duplicateFrameFilter = DuplicateFrameFilter()

    private val serviceScope = CoroutineScope(Dispatchers.Default + Job())
    private var isProcessingFrame = false

    // Frame rate & diagnostics
    private var frameCount = 0
    private var lastFpsTimestamp = System.currentTimeMillis()
    private var currentFps = 0f

    // Region Of Interest (ROI) default (e.g. top 30% of screen where casino banners reside)
    private var roiCropRect: Rect? = null
    private var screenWidth = 1080
    private var screenHeight = 2400
    private var screenDensity = 420

    // European roulette number regex pattern (0-36)
    private val numberRegex = Pattern.compile("\\b([0-9]|[12][0-9]|3[0-6])\\b")

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
        val resultData = intent?.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)

        if (resultCode != Activity.RESULT_OK || resultData == null) {
            Log.e(TAG, "MediaProjection result data missing. Stopping service.")
            stopSelf()
            return START_NOT_STICKY
        }

        startForegroundWithMediaProjectionNotification()
        initMediaProjection(resultCode, resultData)

        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Roulette OCR Screen Capture",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Captures casino stream for roulette number OCR and pattern prediction"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundWithMediaProjectionNotification() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Roulette OCR Active")
            .setContentText("Screen capture and pattern engine running...")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun initMediaProjection(resultCode: Int, data: Intent) {
        val mpManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = mpManager.getMediaProjection(resultCode, data)

        val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        windowManager.defaultDisplay.getRealMetrics(metrics)
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi

        // Default ROI: Upper 35% of stream (standard location for casino winning number banner)
        roiCropRect = Rect(0, 0, screenWidth, (screenHeight * 0.35f).toInt())

        // ImageReader for capturing frames (single buffered at a time)
        imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2)

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "RouletteStreamCapture",
            screenWidth,
            screenHeight,
            screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface,
            null,
            null
        )

        imageReader?.setOnImageAvailableListener({ reader ->
            handleCapturedFrame(reader)
        }, null)

        Log.d(TAG, "MediaProjection VirtualDisplay initialized: ${screenWidth}x${screenHeight} @ ${screenDensity}dpi")
    }

    private fun handleCapturedFrame(reader: ImageReader) {
        val image = reader.acquireLatestImage() ?: return

        // Throttle processing: skip frame if previous OCR is still running
        if (isProcessingFrame) {
            image.close()
            return
        }

        isProcessingFrame = true
        serviceScope.launch {
            try {
                processImageWithMLKit(image)
            } catch (e: Exception) {
                Log.e(TAG, "Error in OCR frame processing", e)
            } finally {
                image.close()
                isProcessingFrame = false
            }
        }
    }

    private suspend fun processImageWithMLKit(image: Image) {
        updateFps()

        // Extract bitmap from Image buffer
        val bitmap = imageToBitmap(image) ?: return

        // Crop to Region of Interest (ROI) if configured
        val targetBitmap = roiCropRect?.let { crop ->
            val safeWidth = crop.width().coerceAtMost(bitmap.width - crop.left)
            val safeHeight = crop.height().coerceAtMost(bitmap.height - crop.top)
            if (safeWidth > 0 && safeHeight > 0) {
                Bitmap.createBitmap(bitmap, crop.left, crop.top, safeWidth, safeHeight)
            } else {
                bitmap
            }
        } ?: bitmap

        val inputImage = InputImage.fromBitmap(targetBitmap, 0)

        withContext(Dispatchers.IO) {
            textRecognizer.process(inputImage)
                .addOnSuccessListener { visionText ->
                    parseDetectedText(visionText.text)
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "ML Kit OCR failure", e)
                }
        }
    }

    private fun parseDetectedText(rawText: String) {
        if (rawText.isBlank()) return

        val matcher = numberRegex.matcher(rawText)
        val detectedNumbers = mutableListOf<Int>()

        while (matcher.find()) {
            val numStr = matcher.group()
            numStr?.toIntOrNull()?.let { num ->
                if (num in 0..36) {
                    detectedNumbers.add(num)
                }
            }
        }

        if (detectedNumbers.isEmpty()) return

        // Prefer the most prominent / isolated number found
        val candidate = detectedNumbers.first()

        // Pass through duplicate frame filter
        val filterResult = duplicateFrameFilter.processFrame(candidate)

        OverlayService.instance?.updateDedupStatus(filterResult.message, currentFps)

        if (filterResult.status == DuplicateFrameFilter.FilterStatus.ACCEPTED_NEW_SPIN && filterResult.confirmedNumber != null) {
            Log.i(TAG, "ACCEPTED NEW ROULETTE NUMBER: ${filterResult.confirmedNumber}")
            val newSpin = RouletteNumber(filterResult.confirmedNumber)
            OverlayService.analyzer.addNumber(newSpin)
        }
    }

    private fun imageToBitmap(image: Image): Bitmap? {
        val planes = image.planes
        val buffer: ByteBuffer = planes[0].buffer
        val pixelStride = planes[0].pixelStride
        val rowStride = planes[0].rowStride
        val rowPadding = rowStride - pixelStride * image.width

        val bitmap = Bitmap.createBitmap(
            image.width + rowPadding / pixelStride,
            image.height,
            Bitmap.Config.ARGB_8888
        )
        bitmap.copyPixelsFromBuffer(buffer)
        return bitmap
    }

    private fun updateFps() {
        frameCount++
        val now = System.currentTimeMillis()
        val elapsed = now - lastFpsTimestamp
        if (elapsed >= 1000) {
            currentFps = (frameCount * 1000f) / elapsed
            frameCount = 0
            lastFpsTimestamp = now
        }
    }

    fun toggleRoiOverlay() {
        // Toggle or recalibrate ROI crop area
        Log.d(TAG, "ROI Calibration toggled")
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        textRecognizer.close()
        virtualDisplay?.release()
        imageReader?.close()
        mediaProjection?.stop()
        instance = null
    }
}
