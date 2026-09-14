package com.roulette.ocrpredictor

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.roulette.ocrpredictor.service.OverlayService
import com.roulette.ocrpredictor.service.ScreenCaptureService

/**
 * Main Controller Activity.
 * Orchestrates System Alert Window (Overlay) permission and MediaProjection Screen Capture grants.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var tvPermissionStatus: TextView
    private lateinit var tvCaptureStatus: TextView
    private lateinit var btnGrantOverlay: Button
    private lateinit var btnStartPredictor: Button
    private lateinit var btnStopPredictor: Button

    private lateinit var mediaProjectionManager: MediaProjectionManager

    // Activity Result Launcher for MediaProjection prompt
    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startForegroundCaptureService(result.resultCode, result.data!!)
        } else {
            Toast.makeText(this, "Screen capture permission denied", Toast.LENGTH_SHORT).show()
            updateUiState()
        }
    }

    // Permission launcher for Notifications on Android 13+
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (!isGranted) {
            Toast.makeText(this, "Notification permission is required for foreground capture", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

        initViews()
        setupListeners()
        checkNotificationPermission()
    }

    override fun onResume() {
        super.onResume()
        updateUiState()
    }

    private fun initViews() {
        tvPermissionStatus = findViewById(R.id.tvPermissionStatus)
        tvCaptureStatus = findViewById(R.id.tvCaptureStatus)
        btnGrantOverlay = findViewById(R.id.btnGrantOverlay)
        btnStartPredictor = findViewById(R.id.btnStartPredictor)
        btnStopPredictor = findViewById(R.id.btnStopPredictor)
    }

    private fun setupListeners() {
        btnGrantOverlay.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
                startActivity(intent)
            } else {
                Toast.makeText(this, "Overlay permission already granted!", Toast.LENGTH_SHORT).show()
            }
        }

        btnStartPredictor.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "Please grant Floating Overlay permission first", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            // Start Floating Overlay Service
            val overlayIntent = Intent(this, OverlayService::class.java)
            startService(overlayIntent)

            // Request MediaProjection Screen Capture intent
            val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
            screenCaptureLauncher.launch(captureIntent)
        }

        btnStopPredictor.setOnClickListener {
            stopService(Intent(this, ScreenCaptureService::class.java))
            stopService(Intent(this, OverlayService::class.java))
            updateUiState()
            Toast.makeText(this, "Roulette OCR Predictor stopped", Toast.LENGTH_SHORT).show()
        }
    }

    private fun startForegroundCaptureService(resultCode: Int, data: Intent) {
        val captureServiceIntent = Intent(this, ScreenCaptureService::class.java).apply {
            putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
            putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, data)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(captureServiceIntent)
        } else {
            startService(captureServiceIntent)
        }

        Toast.makeText(this, "Roulette OCR & Floating HUD Activated!", Toast.LENGTH_LONG).show()
        updateUiState()
        // Move app to background so user can switch to their casino app
        moveTaskToBack(true)
    }

    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun updateUiState() {
        val hasOverlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(this)
        } else true

        if (hasOverlay) {
            tvPermissionStatus.text = "Overlay Permission: GRANTED"
            tvPermissionStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_light))
            btnGrantOverlay.isEnabled = false
        } else {
            tvPermissionStatus.text = "Overlay Permission: REQUIRED (Click below to grant)"
            tvPermissionStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_light))
            btnGrantOverlay.isEnabled = true
        }

        val isRunning = ScreenCaptureService.instance != null && OverlayService.instance != null
        if (isRunning) {
            tvCaptureStatus.text = "OCR Engine: RUNNING (Live Floating Overlay Active)"
            tvCaptureStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_light))
            btnStartPredictor.isEnabled = false
            btnStopPredictor.isEnabled = true
        } else {
            tvCaptureStatus.text = "OCR Engine: STOPPED"
            tvCaptureStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_orange_light))
            btnStartPredictor.isEnabled = true
            btnStopPredictor.isEnabled = false
        }
    }
}
