import { AndroidCodeFile } from '../types';

export const ANDROID_FILES: AndroidCodeFile[] = [
  {
    name: 'AndroidManifest.xml',
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Declares MediaProjection foreground service type, System Alert Window overlay permissions, and main activity.',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.roulette.ocrpredictor">

    <!-- Permissions required for Floating Overlay HUD -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <!-- Permissions required for MediaProjection screen capture foreground service -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Hardware & Utility permissions -->
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.RouletteOCRPredictor"
        tools:targetApi="34">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"
            android:theme="@style/Theme.RouletteOCRPredictor">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- MediaProjection Screen Capture Service (Foreground Service Type: mediaProjection) -->
        <service
            android:name=".service.ScreenCaptureService"
            android:exported="false"
            android:foregroundServiceType="mediaProjection" />

        <!-- Floating System Alert Window Overlay Service -->
        <service
            android:name=".service.OverlayService"
            android:exported="false" />

    </application>

</manifest>`
  },
  {
    name: 'build.gradle.kts (App)',
    path: 'app/build.gradle.kts',
    language: 'groovy',
    description: 'Gradle build configuration with Google ML Kit Text Recognition, AndroidX, Lifecycle, Coroutines, and ViewBinding.',
    code: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.roulette.ocrpredictor"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.roulette.ocrpredictor"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    // AndroidX Core & UI
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.cardview:cardview:1.0.0")

    // Kotlin Coroutines & Lifecycle
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-service:2.7.0")

    // Google ML Kit Text Recognition (Fast On-Device Latin OCR)
    implementation("com.google.android.gms:play-services-mlkit-text-recognition:19.0.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}`
  },
  {
    name: 'OverlayService.kt',
    path: 'app/src/main/java/com/roulette/ocrpredictor/service/OverlayService.kt',
    language: 'kotlin',
    description: 'WindowManager floating HUD overlay with drag-to-move touch listener, RTL spin chips, signal card, and zero pause alerts.',
    code: `package com.roulette.ocrpredictor.service

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.*
import android.widget.*
import androidx.cardview.widget.CardView
import com.roulette.ocrpredictor.R
import com.roulette.ocrpredictor.analyzer.RoulettePatternAnalyzer
import com.roulette.ocrpredictor.model.PatternType
import com.roulette.ocrpredictor.model.PredictionResult
import com.roulette.ocrpredictor.model.RouletteColor
import com.roulette.ocrpredictor.model.RouletteNumber
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest

/**
 * Floating System Alert Window Overlay Service.
 * Manages the interactive draggable HUD overlay that sits directly above
 * live casino apps / video streams.
 */
class OverlayService : Service() {

    companion object {
        var instance: OverlayService? = null
            private set

        val analyzer = RoulettePatternAnalyzer()
    }

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private lateinit var windowParams: WindowManager.LayoutParams

    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())

    // UI View References
    private lateinit var cardOverlayRoot: CardView
    private lateinit var layoutDragHeader: LinearLayout
    private lateinit var layoutOverlayBody: LinearLayout
    private lateinit var tvStatusLabel: TextView
    private lateinit var viewStatusDot: View
    private lateinit var btnMinimize: ImageButton
    private lateinit var btnClose: ImageButton

    private lateinit var frameLastNumber: FrameLayout
    private lateinit var tvLastNumber: TextView
    private lateinit var tvPredictedBet: TextView
    private lateinit var tvConfidenceBadge: TextView
    private lateinit var tvActivePattern: TextView
    private lateinit var layoutZeroPauseBanner: LinearLayout

    private lateinit var layoutHistoryContainer: LinearLayout
    private lateinit var tvSubDozen: TextView
    private lateinit var tvSubColumn: TextView
    private lateinit var tvSubHiLo: TextView
    private lateinit var tvSubEvenOdd: TextView
    private lateinit var tvDedupFilterStatus: TextView
    private lateinit var tvFpsCounter: TextView

    private lateinit var btnCalibrateRoi: Button
    private lateinit var btnManualInput: Button
    private lateinit var btnClearHistory: Button

    private var isMinimized = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        initOverlayWindow()
        initViews()
        setupTouchListener()
        setupListeners()
        observeAnalyzer()
    }

    private fun initOverlayWindow() {
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        windowParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 40
            y = 120
        }

        val inflater = LayoutInflater.from(this)
        overlayView = inflater.inflate(R.layout.overlay_layout, null)
        windowManager.addView(overlayView, windowParams)
    }

    private fun initViews() {
        cardOverlayRoot = overlayView.findViewById(R.id.cardOverlayRoot)
        layoutDragHeader = overlayView.findViewById(R.id.layoutDragHeader)
        layoutOverlayBody = overlayView.findViewById(R.id.layoutOverlayBody)
        tvStatusLabel = overlayView.findViewById(R.id.tvStatusLabel)
        viewStatusDot = overlayView.findViewById(R.id.viewStatusDot)
        btnMinimize = overlayView.findViewById(R.id.btnMinimize)
        btnClose = overlayView.findViewById(R.id.btnClose)

        frameLastNumber = overlayView.findViewById(R.id.frameLastNumber)
        tvLastNumber = overlayView.findViewById(R.id.tvLastNumber)
        tvPredictedBet = overlayView.findViewById(R.id.tvPredictedBet)
        tvConfidenceBadge = overlayView.findViewById(R.id.tvConfidenceBadge)
        tvActivePattern = overlayView.findViewById(R.id.tvActivePattern)
        layoutZeroPauseBanner = overlayView.findViewById(R.id.layoutZeroPauseBanner)

        layoutHistoryContainer = overlayView.findViewById(R.id.layoutHistoryContainer)
        tvSubDozen = overlayView.findViewById(R.id.tvSubDozen)
        tvSubColumn = overlayView.findViewById(R.id.tvSubColumn)
        tvSubHiLo = overlayView.findViewById(R.id.tvSubHiLo)
        tvSubEvenOdd = overlayView.findViewById(R.id.tvSubEvenOdd)
        tvDedupFilterStatus = overlayView.findViewById(R.id.tvDedupFilterStatus)
        tvFpsCounter = overlayView.findViewById(R.id.tvFpsCounter)

        btnCalibrateRoi = overlayView.findViewById(R.id.btnCalibrateRoi)
        btnManualInput = overlayView.findViewById(R.id.btnManualInput)
        btnClearHistory = overlayView.findViewById(R.id.btnClearHistory)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupTouchListener() {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f

        layoutDragHeader.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = windowParams.x
                    initialY = windowParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    windowParams.x = initialX + (event.rawX - initialTouchX).toInt()
                    windowParams.y = initialY + (event.rawY - initialTouchY).toInt()
                    try {
                        windowManager.updateViewLayout(overlayView, windowParams)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun setupListeners() {
        btnMinimize.setOnClickListener {
            toggleMinimize()
        }

        btnClose.setOnClickListener {
            stopSelf()
        }

        btnClearHistory.setOnClickListener {
            analyzer.reset()
            Toast.makeText(this, "Roulette history reset", Toast.LENGTH_SHORT).show()
        }

        btnManualInput.setOnClickListener {
            showQuickNumberPicker()
        }

        btnCalibrateRoi.setOnClickListener {
            ScreenCaptureService.instance?.toggleRoiOverlay()
            Toast.makeText(this, "Adjust OCR capture crop region", Toast.LENGTH_SHORT).show()
        }
    }

    private fun toggleMinimize() {
        isMinimized = !isMinimized
        if (isMinimized) {
            layoutOverlayBody.visibility = View.GONE
            btnMinimize.setImageResource(android.R.drawable.arrow_up_float)
        } else {
            layoutOverlayBody.visibility = View.VISIBLE
            btnMinimize.setImageResource(android.R.drawable.arrow_down_float)
        }
        windowManager.updateViewLayout(overlayView, windowParams)
    }

    private fun observeAnalyzer() {
        serviceScope.launch {
            analyzer.currentPrediction.collectLatest { prediction ->
                updatePredictionUI(prediction)
            }
        }

        serviceScope.launch {
            analyzer.history.collectLatest { historyList ->
                updateHistoryStrip(historyList)
            }
        }
    }

    private fun updatePredictionUI(prediction: PredictionResult) {
        tvPredictedBet.text = prediction.primaryBet
        tvConfidenceBadge.text = "CONF: \${prediction.confidencePercent}%"
        tvActivePattern.text = "Pattern: \${prediction.patternType.displayName}"

        // Zero (0) Pause Banner Handling
        if (prediction.isZeroPaused) {
            layoutZeroPauseBanner.visibility = View.VISIBLE
            tvPredictedBet.setTextColor(Color.parseColor("#34D399"))
            tvConfidenceBadge.setBackgroundColor(Color.parseColor("#064E3B"))
        } else {
            layoutZeroPauseBanner.visibility = View.GONE
            when {
                prediction.primaryBet.contains("RED") -> {
                    tvPredictedBet.setTextColor(Color.parseColor("#EF4444"))
                    tvConfidenceBadge.setBackgroundColor(Color.parseColor("#7F1D1D"))
                }
                prediction.primaryBet.contains("BLACK") -> {
                    tvPredictedBet.setTextColor(Color.parseColor("#E2E8F0"))
                    tvConfidenceBadge.setBackgroundColor(Color.parseColor("#334155"))
                }
                else -> {
                    tvPredictedBet.setTextColor(Color.parseColor("#38BDF8"))
                    tvConfidenceBadge.setBackgroundColor(Color.parseColor("#1E293B"))
                }
            }
        }

        tvSubDozen.text = prediction.suggestedDozen
        tvSubColumn.text = prediction.suggestedColumn
        tvSubHiLo.text = prediction.suggestedHiLo
        tvSubEvenOdd.text = prediction.suggestedEvenOdd
    }

    private fun updateHistoryStrip(history: List<RouletteNumber>) {
        layoutHistoryContainer.removeAllViews()

        if (history.isEmpty()) {
            tvLastNumber.text = "--"
            frameLastNumber.background = createCircleDrawable(Color.parseColor("#334155"))
            return
        }

        val latest = history.first()
        tvLastNumber.text = latest.value.toString()
        val latestBgColor = when (latest.color) {
            RouletteColor.RED -> Color.parseColor("#DC2626")
            RouletteColor.BLACK -> Color.parseColor("#1E293B")
            RouletteColor.GREEN_ZERO -> Color.parseColor("#059669")
        }
        frameLastNumber.background = createCircleDrawable(latestBgColor)

        val density = resources.displayMetrics.density
        val chipSize = (26 * density).toInt()
        val marginEnd = (4 * density).toInt()

        for (spin in history.take(15)) {
            val chip = TextView(this).apply {
                layoutParams = LinearLayout.LayoutParams(chipSize, chipSize).apply {
                    setMargins(0, 0, marginEnd, 0)
                }
                gravity = Gravity.CENTER
                text = spin.value.toString()
                textSize = 11f
                setTextColor(Color.WHITE)

                val chipColor = when (spin.color) {
                    RouletteColor.RED -> Color.parseColor("#DC2626")
                    RouletteColor.BLACK -> Color.parseColor("#334155")
                    RouletteColor.GREEN_ZERO -> Color.parseColor("#059669")
                }
                background = createCircleDrawable(chipColor)
            }
            layoutHistoryContainer.addView(chip)
        }
    }

    private fun createCircleDrawable(color: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(color)
            setStroke(2, Color.parseColor("#475569"))
        }
    }

    fun updateDedupStatus(message: String, fps: Float) {
        serviceScope.launch {
            tvDedupFilterStatus.text = message
            tvFpsCounter.text = String.format("OCR: %.1f fps", fps)
        }
    }

    private fun showQuickNumberPicker() {
        val popup = PopupMenu(this, btnManualInput)
        for (num in 0..36) {
            popup.menu.add(0, num, num, num.toString())
        }
        popup.setOnMenuItemClickListener { item ->
            val num = item.itemId
            analyzer.addNumber(RouletteNumber(num))
            Toast.makeText(this, "Manually added #$num", Toast.LENGTH_SHORT).show()
            true
        }
        popup.show()
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        if (::overlayView.isInitialized) {
            try {
                windowManager.removeView(overlayView)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        instance = null
    }
}`
  },
  {
    name: 'overlay_layout.xml',
    path: 'app/src/main/res/layout/overlay_layout.xml',
    language: 'xml',
    description: 'HUD floating view layout with drag header, latest number ring, primary recommendation, zero alert, RTL history strip, sub-bets, and action buttons.',
    code: `<?xml version="1.0" encoding="utf-8"?>
<androidx.cardview.widget.CardView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:id="@+id/cardOverlayRoot"
    android:layout_width="320dp"
    android:layout_height="wrap_content"
    android:layout_gravity="center"
    app:cardBackgroundColor="#121824"
    app:cardCornerRadius="16dp"
    app:cardElevation="12dp"
    app:cardUseCompatPadding="true">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="12dp">

        <!-- Top Header & Drag Bar -->
        <LinearLayout
            android:id="@+id/layoutDragHeader"
            android:layout_width="match_parent"
            android:layout_height="36dp"
            android:gravity="center_vertical"
            android:orientation="horizontal"
            android:background="#1E293B"
            android:paddingHorizontal="10dp"
            android:paddingVertical="4dp">

            <ImageView
                android:id="@+id/ivDragHandle"
                android:layout_width="18dp"
                android:layout_height="18dp"
                android:src="@android:drawable/ic_menu_sort_by_size"
                android:contentDescription="Drag overlay handle"
                app:tint="#94A3B8" />

            <TextView
                android:id="@+id/tvAppTitle"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:layout_marginStart="8dp"
                android:text="ROULETTE OCR HUD"
                android:textColor="#F8FAFC"
                android:textSize="12sp"
                android:textStyle="bold"
                android:letterSpacing="0.05" />

            <View
                android:id="@+id/viewStatusDot"
                android:layout_width="8dp"
                android:layout_height="8dp"
                android:layout_marginEnd="6dp"
                android:background="@android:drawable/presence_online" />

            <TextView
                android:id="@+id/tvStatusLabel"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginEnd="8dp"
                android:text="SCANNING"
                android:textColor="#10B981"
                android:textSize="10sp"
                android:textStyle="bold" />

            <ImageButton
                android:id="@+id/btnMinimize"
                android:layout_width="26dp"
                android:layout_height="26dp"
                android:background="?attr/selectableItemBackgroundBorderless"
                android:src="@android:drawable/arrow_down_float"
                android:contentDescription="Minimize Overlay"
                app:tint="#CBD5E1" />

            <ImageButton
                android:id="@+id/btnClose"
                android:layout_width="26dp"
                android:layout_height="26dp"
                android:background="?attr/selectableItemBackgroundBorderless"
                android:src="@android:drawable/ic_menu_close_clear_cancel"
                android:contentDescription="Close Overlay"
                app:tint="#EF4444" />
        </LinearLayout>

        <!-- Collapsible Content Body -->
        <LinearLayout
            android:id="@+id/layoutOverlayBody"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:layout_marginTop="8dp">

            <!-- Latest Detected Spin & Primary Signal Section -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:background="#0F172A"
                android:padding="10dp">

                <FrameLayout
                    android:id="@+id/frameLastNumber"
                    android:layout_width="54dp"
                    android:layout_height="54dp"
                    android:background="@android:drawable/btn_default">

                    <TextView
                        android:id="@+id/tvLastNumber"
                        android:layout_width="match_parent"
                        android:layout_height="match_parent"
                        android:gravity="center"
                        android:text="--"
                        android:textColor="#FFFFFF"
                        android:textSize="22sp"
                        android:textStyle="bold" />
                </FrameLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:layout_marginStart="12dp"
                    android:orientation="vertical">

                    <LinearLayout
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:orientation="horizontal"
                        android:gravity="center_vertical">

                        <TextView
                            android:id="@+id/tvPredictionLabel"
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:text="NEXT SIGNAL"
                            android:textColor="#94A3B8"
                            android:textSize="10sp"
                            android:textStyle="bold" />

                        <TextView
                            android:id="@+id/tvConfidenceBadge"
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:layout_marginStart="6dp"
                            android:background="#1E293B"
                            android:paddingHorizontal="6dp"
                            android:paddingVertical="1dp"
                            android:text="CONF: 85%"
                            android:textColor="#F59E0B"
                            android:textSize="9sp"
                            android:textStyle="bold" />
                    </LinearLayout>

                    <TextView
                        android:id="@+id/tvPredictedBet"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginTop="2dp"
                        android:text="WAITING FOR DATA"
                        android:textColor="#E2E8F0"
                        android:textSize="16sp"
                        android:textStyle="bold" />

                    <TextView
                        android:id="@+id/tvActivePattern"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginTop="2dp"
                        android:text="Pattern: Calibrating (Need >= 3 spins)"
                        android:textColor="#38BDF8"
                        android:textSize="11sp" />
                </LinearLayout>
            </LinearLayout>

            <!-- Zero Pause Banner -->
            <LinearLayout
                android:id="@+id/layoutZeroPauseBanner"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="6dp"
                android:background="#064E3B"
                android:padding="6dp"
                android:gravity="center_vertical"
                android:visibility="gone"
                tools:visibility="visible">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="⚠️ ZERO (0) GREEN PAUSE"
                    android:textColor="#34D399"
                    android:textSize="11sp"
                    android:textStyle="bold" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="6dp"
                    android:text="Skip 1 spin to reset pattern base"
                    android:textColor="#A7F3D0"
                    android:textSize="10sp" />
            </LinearLayout>

            <!-- RTL Pattern Analysis Strip -->
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:text="RIGHT-TO-LEFT SPIN HISTORY (Latest -> Previous)"
                android:textColor="#64748B"
                android:textSize="9sp"
                android:textStyle="bold" />

            <HorizontalScrollView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="4dp"
                android:scrollbars="none">

                <LinearLayout
                    android:id="@+id/layoutHistoryContainer"
                    android:layout_width="wrap_content"
                    android:layout_height="32dp"
                    android:orientation="horizontal"
                    android:gravity="center_vertical">
                </LinearLayout>
            </HorizontalScrollView>

            <!-- Sub-Predictions -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:orientation="horizontal"
                android:weightSum="4">

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center"
                    android:background="#1E293B"
                    android:padding="4dp"
                    android:layout_marginEnd="2dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="DOZEN"
                        android:textColor="#94A3B8"
                        android:textSize="9sp" />

                    <TextView
                        android:id="@+id/tvSubDozen"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="--"
                        android:textColor="#F1F5F9"
                        android:textSize="11sp"
                        android:textStyle="bold" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center"
                    android:background="#1E293B"
                    android:padding="4dp"
                    android:layout_marginEnd="2dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="COLUMN"
                        android:textColor="#94A3B8"
                        android:textSize="9sp" />

                    <TextView
                        android:id="@+id/tvSubColumn"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="--"
                        android:textColor="#F1F5F9"
                        android:textSize="11sp"
                        android:textStyle="bold" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center"
                    android:background="#1E293B"
                    android:padding="4dp"
                    android:layout_marginEnd="2dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="HI / LO"
                        android:textColor="#94A3B8"
                        android:textSize="9sp" />

                    <TextView
                        android:id="@+id/tvSubHiLo"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="--"
                        android:textColor="#F1F5F9"
                        android:textSize="11sp"
                        android:textStyle="bold" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center"
                    android:background="#1E293B"
                    android:padding="4dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="EVEN/ODD"
                        android:textColor="#94A3B8"
                        android:textSize="9sp" />

                    <TextView
                        android:id="@+id/tvSubEvenOdd"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="--"
                        android:textColor="#F1F5F9"
                        android:textSize="11sp"
                        android:textStyle="bold" />
                </LinearLayout>
            </LinearLayout>

            <!-- Duplicate Frame Filter Status -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:orientation="horizontal"
                android:gravity="center_vertical">

                <TextView
                    android:id="@+id/tvDedupFilterStatus"
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:text="Dedup: Filter Armed (Hold 8s / State lock)"
                    android:textColor="#64748B"
                    android:textSize="9sp" />

                <TextView
                    android:id="@+id/tvFpsCounter"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="OCR: 3.5 fps"
                    android:textColor="#64748B"
                    android:textSize="9sp" />
            </LinearLayout>

            <!-- Bottom Action Buttons -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:orientation="horizontal">

                <Button
                    android:id="@+id/btnCalibrateRoi"
                    android:layout_width="0dp"
                    android:layout_height="32dp"
                    android:layout_weight="1"
                    android:layout_marginEnd="4dp"
                    android:backgroundTint="#334155"
                    android:text="Crop ROI"
                    android:textColor="#E2E8F0"
                    android:textSize="10sp"
                    android:insetTop="0dp"
                    android:insetBottom="0dp" />

                <Button
                    android:id="@+id/btnManualInput"
                    android:layout_width="0dp"
                    android:layout_height="32dp"
                    android:layout_weight="1"
                    android:layout_marginEnd="4dp"
                    android:backgroundTint="#334155"
                    android:text="+ Manual"
                    android:textColor="#E2E8F0"
                    android:textSize="10sp"
                    android:insetTop="0dp"
                    android:insetBottom="0dp" />

                <Button
                    android:id="@+id/btnClearHistory"
                    android:layout_width="0dp"
                    android:layout_height="32dp"
                    android:layout_weight="1"
                    android:backgroundTint="#7F1D1D"
                    android:text="Reset"
                    android:textColor="#FECACA"
                    android:textSize="10sp"
                    android:insetTop="0dp"
                    android:insetBottom="0dp" />
            </LinearLayout>

        </LinearLayout>

    </LinearLayout>

</androidx.cardview.widget.CardView>`
  },
  {
    name: 'ScreenCaptureService.kt',
    path: 'app/src/main/java/com/roulette/ocrpredictor/service/ScreenCaptureService.kt',
    language: 'kotlin',
    description: 'MediaProjection foreground capture service running Google ML Kit Text Recognition with ROI cropping and duplicate frame debouncer.',
    code: `package com.roulette.ocrpredictor.service

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

    private var frameCount = 0
    private var lastFpsTimestamp = System.currentTimeMillis()
    private var currentFps = 0f

    private var roiCropRect: Rect? = null
    private var screenWidth = 1080
    private var screenHeight = 2400
    private var screenDensity = 420

    private val numberRegex = Pattern.compile("\\\\b([0-9]|[12][0-9]|3[0-6])\\\\b")

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

        roiCropRect = Rect(0, 0, screenWidth, (screenHeight * 0.35f).toInt())
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

        Log.d(TAG, "MediaProjection VirtualDisplay initialized: \${screenWidth}x\${screenHeight} @ \${screenDensity}dpi")
    }

    private fun handleCapturedFrame(reader: ImageReader) {
        val image = reader.acquireLatestImage() ?: return

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

        val bitmap = imageToBitmap(image) ?: return

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
        val candidate = detectedNumbers.first()

        val filterResult = duplicateFrameFilter.processFrame(candidate)
        OverlayService.instance?.updateDedupStatus(filterResult.message, currentFps)

        if (filterResult.status == DuplicateFrameFilter.FilterStatus.ACCEPTED_NEW_SPIN && filterResult.confirmedNumber != null) {
            Log.i(TAG, "ACCEPTED NEW ROULETTE NUMBER: \${filterResult.confirmedNumber}")
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
}`
  },
  {
    name: 'RoulettePatternAnalyzer.kt',
    path: 'app/src/main/java/com/roulette/ocrpredictor/analyzer/RoulettePatternAnalyzer.kt',
    language: 'kotlin',
    description: 'RTL sequence analyzer implementing Zig-Zag, Bracket, Color Flow, False Break, 123, Group March, 2*2, and Zero (0) 1-spin pause.',
    code: `package com.roulette.ocrpredictor.analyzer

import com.roulette.ocrpredictor.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Core Roulette Pattern Analyzer utilizing Right-to-Left chronological sequence evaluation.
 */
class RoulettePatternAnalyzer {

    private val _history = MutableStateFlow<List<RouletteNumber>>(emptyList())
    val history: StateFlow<List<RouletteNumber>> = _history.asStateFlow()

    private val _currentPrediction = MutableStateFlow(
        PredictionResult(
            primaryBet = "CALIBRATING",
            patternType = PatternType.NONE,
            confidencePercent = 0,
            explanation = "Awaiting minimum 3 spins for RTL pattern detection",
            isZeroPaused = false
        )
    )
    val currentPrediction: StateFlow<PredictionResult> = _currentPrediction.asStateFlow()

    private var zeroPauseArmed: Boolean = false
    private var zeroPauseSpinCount: Int = 0

    @Synchronized
    fun addNumber(number: RouletteNumber) {
        val currentList = _history.value.toMutableList()
        currentList.add(0, number) // Prepend: Index 0 is newest (RTL analysis anchor)

        if (currentList.size > 60) {
            currentList.removeAt(currentList.lastIndex)
        }
        _history.value = currentList
        evaluatePrediction(currentList)
    }

    @Synchronized
    fun reset() {
        _history.value = emptyList()
        zeroPauseArmed = false
        zeroPauseSpinCount = 0
        _currentPrediction.value = PredictionResult(
            primaryBet = "READY",
            patternType = PatternType.NONE,
            confidencePercent = 0,
            explanation = "History cleared. Waiting for next spin."
        )
    }

    private fun evaluatePrediction(spins: List<RouletteNumber>) {
        if (spins.isEmpty()) return

        val latest = spins[0]

        // --- RULE 1: ZERO (0) GREEN HANDLING (1-SPIN PAUSE) ---
        if (latest.value == 0) {
            zeroPauseArmed = true
            zeroPauseSpinCount = 1
            _currentPrediction.value = PredictionResult(
                primaryBet = "PAUSE / NO BET",
                patternType = PatternType.ZERO_PAUSE,
                confidencePercent = 100,
                explanation = "Zero (0) Green landed! Pausing 1 spin to re-establish reference baseline.",
                isZeroPaused = true
            )
            return
        }

        if (zeroPauseArmed) {
            zeroPauseSpinCount--
            if (zeroPauseSpinCount <= 0) {
                zeroPauseArmed = false
            } else {
                _currentPrediction.value = PredictionResult(
                    primaryBet = "PAUSE / NO BET",
                    patternType = PatternType.ZERO_PAUSE,
                    confidencePercent = 100,
                    explanation = "Zero cooldown active. Pausing for 1 spin.",
                    isZeroPaused = true
                )
                return
            }
        }

        val nonZeroSpins = spins.filter { it.value != 0 }
        if (nonZeroSpins.size < 3) {
            _currentPrediction.value = PredictionResult(
                primaryBet = "OBSERVING",
                patternType = PatternType.NONE,
                confidencePercent = 35,
                explanation = "Collecting baseline: \${nonZeroSpins.size}/3 spins recorded."
            )
            return
        }

        val colors = nonZeroSpins.map { it.color }
        val dozens = nonZeroSpins.map { it.dozen }
        val columns = nonZeroSpins.map { it.column }
        val parities = nonZeroSpins.map { it.parity }
        val hiLos = nonZeroSpins.map { it.hiLo }

        // --- PATTERN LOGIC 1: FALSE BREAK (SNAPBACK) ---
        if (colors.size >= 4) {
            val c0 = colors[0]
            val c1 = colors[1]
            val c2 = colors[2]
            val c3 = colors[3]
            if (c0 != c1 && c1 == c2 && c2 == c3) {
                val targetName = if (c1 == RouletteColor.RED) "RED" else "BLACK"
                _currentPrediction.value = PredictionResult(
                    primaryBet = "BET $targetName",
                    patternType = PatternType.FALSE_BREAK,
                    confidencePercent = 88,
                    explanation = "False Break detected! Single disruption against 3x $targetName. Snapback expected to $targetName.",
                    suggestedDozen = predictDozenExhaustion(dozens),
                    suggestedColumn = predictColumnExhaustion(columns),
                    suggestedHiLo = hiLos[0].name,
                    suggestedEvenOdd = parities[0].name
                )
                return
            }
        }

        // --- PATTERN LOGIC 2: 2*2 PAIR FLOW ---
        if (colors.size >= 4) {
            val c0 = colors[0]
            val c1 = colors[1]
            val c2 = colors[2]
            val c3 = colors[3]
            if (c0 == c1 && c2 == c3 && c0 != c2) {
                val targetName = if (c2 == RouletteColor.RED) "RED" else "BLACK"
                _currentPrediction.value = PredictionResult(
                    primaryBet = "BET $targetName",
                    patternType = PatternType.PATTERN_2X2,
                    confidencePercent = 85,
                    explanation = "2*2 Pattern confirmed: [\${c3.name.take(1)}x2 -> \${c1.name.take(1)}x2]. Predict switch to $targetName to initiate next pair.",
                    suggestedDozen = predictDozenTrend(dozens),
                    suggestedColumn = predictColumnTrend(columns),
                    suggestedHiLo = if (nonZeroSpins[0].hiLo == HiLo.HIGH) "LOW" else "HIGH",
                    suggestedEvenOdd = if (nonZeroSpins[0].parity == Parity.EVEN) "ODD" else "EVEN"
                )
                return
            }
        }

        // --- PATTERN LOGIC 3: BRACKET PATTERN (A-B-B-A) ---
        if (colors.size >= 3) {
            val c0 = colors[0]
            val c1 = colors[1]
            val c2 = colors[2]
            if (c0 == c1 && c0 != c2) {
                val targetName = if (c2 == RouletteColor.RED) "RED" else "BLACK"
                _currentPrediction.value = PredictionResult(
                    primaryBet = "BET $targetName",
                    patternType = PatternType.BRACKET,
                    confidencePercent = 82,
                    explanation = "Bracket Pattern: [\${c2.name.take(1)} - \${c1.name.take(1)} - \${c0.name.take(1)}]. Predict outer closure $targetName.",
                    suggestedDozen = predictDozenTrend(dozens),
                    suggestedColumn = predictColumnTrend(columns),
                    suggestedHiLo = hiLos[0].name,
                    suggestedEvenOdd = parities[0].name
                )
                return
            }
        }

        // --- PATTERN LOGIC 4: 1-2-3 PROGRESSION ---
        if (colors.size >= 5) {
            val c0 = colors[0]
            val c1 = colors[1]
            val c2 = colors[2]
            val c3 = colors[3]
            val c4 = colors[4]
            if (c4 != c3 && c3 == c2 && c2 != c1 && c1 == c0 && c0 == c4) {
                val targetName = if (c0 == RouletteColor.RED) "RED" else "BLACK"
                _currentPrediction.value = PredictionResult(
                    primaryBet = "BET $targetName",
                    patternType = PatternType.PATTERN_123,
                    confidencePercent = 84,
                    explanation = "1-2-3 Progression: 1x\${c4.name.take(1)}, 2x\${c3.name.take(1)}, currently 2x\${c0.name.take(1)}. Predict 3rd $targetName to complete 1-2-3.",
                    suggestedDozen = predictDozenTrend(dozens),
                    suggestedColumn = predictColumnTrend(columns),
                    suggestedHiLo = hiLos[0].name,
                    suggestedEvenOdd = parities[0].name
                )
                return
            }
        }

        // --- PATTERN LOGIC 5: ZIG-ZAG (ALTERNATING FLOW) ---
        var zigZagCount = 1
        for (i in 0 until colors.size - 1) {
            if (colors[i] != colors[i + 1]) {
                zigZagCount++
            } else {
                break
            }
        }
        if (zigZagCount >= 3) {
            val nextColor = if (colors[0] == RouletteColor.RED) RouletteColor.BLACK else RouletteColor.RED
            val targetName = if (nextColor == RouletteColor.RED) "RED" else "BLACK"
            val conf = (70 + (zigZagCount * 4)).coerceAtMost(92)
            _currentPrediction.value = PredictionResult(
                primaryBet = "BET $targetName",
                patternType = PatternType.ZIG_ZAG,
                confidencePercent = conf,
                explanation = "Zig-Zag Alternating Wave (\${zigZagCount}-streak): \${colors[0].name.take(1)} landed, predict wave continuation to $targetName.",
                suggestedDozen = predictDozenTrend(dozens),
                suggestedColumn = predictColumnTrend(columns),
                suggestedHiLo = if (nonZeroSpins[0].hiLo == HiLo.HIGH) "LOW" else "HIGH",
                suggestedEvenOdd = if (nonZeroSpins[0].parity == Parity.EVEN) "ODD" else "EVEN"
            )
            return
        }

        // --- PATTERN LOGIC 6: GROUP MARCH ---
        if (dozens.size >= 3) {
            val d0 = dozens[0]
            val d1 = dozens[1]
            val d2 = dozens[2]
            if (d2 == Dozen.FIRST && d1 == Dozen.SECOND && d0 == Dozen.THIRD) {
                _currentPrediction.value = PredictionResult(
                    primaryBet = "DOZEN 1 (RESET)",
                    patternType = PatternType.GROUP_MARCH,
                    confidencePercent = 78,
                    explanation = "Ascending Group March completed (D1 -> D2 -> D3). Predict cycle reset to 1st Dozen.",
                    suggestedDozen = "1st Dozen (1-12)",
                    suggestedColumn = predictColumnTrend(columns),
                    suggestedHiLo = "LOW (1-18)",
                    suggestedEvenOdd = parities[0].name
                )
                return
            } else if (d2 == Dozen.THIRD && d1 == Dozen.SECOND && d0 == Dozen.FIRST) {
                _currentPrediction.value = PredictionResult(
                    primaryBet = "DOZEN 3 (RESET)",
                    patternType = PatternType.GROUP_MARCH,
                    confidencePercent = 78,
                    explanation = "Descending Group March completed (D3 -> D2 -> D1). Predict cycle reset to 3rd Dozen.",
                    suggestedDozen = "3rd Dozen (25-36)",
                    suggestedColumn = predictColumnTrend(columns),
                    suggestedHiLo = "HIGH (19-36)",
                    suggestedEvenOdd = parities[0].name
                )
                return
            }
        }

        // --- PATTERN LOGIC 7: COLOR FLOW ---
        var streakCount = 1
        for (i in 0 until colors.size - 1) {
            if (colors[i] == colors[i + 1]) {
                streakCount++
            } else {
                break
            }
        }
        if (streakCount >= 3) {
            val dominantColor = colors[0]
            val targetName = if (dominantColor == RouletteColor.RED) "RED" else "BLACK"
            val conf = (72 + (streakCount * 3)).coerceAtMost(89)
            _currentPrediction.value = PredictionResult(
                primaryBet = "BET $targetName",
                patternType = PatternType.COLOR_FLOW,
                confidencePercent = conf,
                explanation = "Color Flow Streak (\${streakCount}x $targetName in a row): Strong momentum flow, predict continuation.",
                suggestedDozen = predictDozenTrend(dozens),
                suggestedColumn = predictColumnTrend(columns),
                suggestedHiLo = hiLos[0].name,
                suggestedEvenOdd = parities[0].name
            )
            return
        }

        val redCount = colors.take(6).count { it == RouletteColor.RED }
        val blackCount = colors.take(6).count { it == RouletteColor.BLACK }
        val recommendedColor = if (redCount > blackCount) "RED" else "BLACK"
        _currentPrediction.value = PredictionResult(
            primaryBet = "BET $recommendedColor",
            patternType = PatternType.NONE,
            confidencePercent = 60,
            explanation = "Balanced micro-trend in recent 6 spins: Red=$redCount, Black=$blackCount.",
            suggestedDozen = predictDozenTrend(dozens),
            suggestedColumn = predictColumnTrend(columns),
            suggestedHiLo = hiLos[0].name,
            suggestedEvenOdd = parities[0].name
        )
    }

    private fun predictDozenTrend(dozens: List<Dozen>): String {
        val valid = dozens.filter { it != Dozen.NONE }.take(5)
        if (valid.isEmpty()) return "--"
        val d1 = valid.count { it == Dozen.FIRST }
        val d2 = valid.count { it == Dozen.SECOND }
        val d3 = valid.count { it == Dozen.THIRD }
        return when {
            d1 >= d2 && d1 >= d3 -> "1st Dozen (1-12)"
            d2 >= d1 && d2 >= d3 -> "2nd Dozen (13-24)"
            else -> "3rd Dozen (25-36)"
        }
    }

    private fun predictDozenExhaustion(dozens: List<Dozen>): String {
        val valid = dozens.filter { it != Dozen.NONE }.take(5)
        if (valid.isEmpty()) return "--"
        val d1 = valid.count { it == Dozen.FIRST }
        val d2 = valid.count { it == Dozen.SECOND }
        val d3 = valid.count { it == Dozen.THIRD }
        return when {
            d1 <= d2 && d1 <= d3 -> "1st Dozen (Overdue)"
            d2 <= d1 && d2 <= d3 -> "2nd Dozen (Overdue)"
            else -> "3rd Dozen (Overdue)"
        }
    }

    private fun predictColumnTrend(columns: List<Column>): String {
        val valid = columns.filter { it != Column.NONE }.take(5)
        if (valid.isEmpty()) return "--"
        val c1 = valid.count { it == Column.COL_1 }
        val c2 = valid.count { it == Column.COL_2 }
        val c3 = valid.count { it == Column.COL_3 }
        return when {
            c1 >= c2 && c1 >= c3 -> "Col 1"
            c2 >= c1 && c2 >= c3 -> "Col 2"
            else -> "Col 3"
        }
    }
}`
  },
  {
    name: 'DuplicateFrameFilter.kt',
    path: 'app/src/main/java/com/roulette/ocrpredictor/ocr/DuplicateFrameFilter.kt',
    language: 'kotlin',
    description: 'Continuous duplicate frame suppressor with state-locking, 7-second refractory cooldown, and 2-frame temporal debounce.',
    code: `package com.roulette.ocrpredictor.ocr

import android.util.Log

class DuplicateFrameFilter(
    private val minSpinCooldownMs: Long = 7000L,
    private val requiredConsistentFrames: Int = 2
) {
    private var lastAcceptedNumber: Int? = null
    private var lastAcceptedTimestamp: Long = 0L

    private var candidateNumber: Int? = null
    private var candidateFrameCount: Int = 0

    enum class FilterStatus {
        ACCEPTED_NEW_SPIN,
        SUPPRESSED_DUPLICATE_LOCKED,
        SUPPRESSED_COOLDOWN_ACTIVE,
        VERIFYING_CANDIDATE,
        INVALID_RANGE
    }

    data class FilterResult(
        val status: FilterStatus,
        val confirmedNumber: Int? = null,
        val message: String
    )

    @Synchronized
    fun processFrame(detectedNumber: Int): FilterResult {
        if (detectedNumber !in 0..36) {
            return FilterResult(
                status = FilterStatus.INVALID_RANGE,
                message = "Value $detectedNumber is out of valid bounds (0-36)."
            )
        }

        val now = System.currentTimeMillis()

        if (lastAcceptedNumber != null && detectedNumber == lastAcceptedNumber) {
            return FilterResult(
                status = FilterStatus.SUPPRESSED_DUPLICATE_LOCKED,
                message = "Duplicate frame: Number $detectedNumber is still displayed on live casino banner."
            )
        }

        val timeSinceLastAccepted = now - lastAcceptedTimestamp
        if (lastAcceptedNumber != null && timeSinceLastAccepted < minSpinCooldownMs) {
            return FilterResult(
                status = FilterStatus.SUPPRESSED_COOLDOWN_ACTIVE,
                message = "Cooldown active: \${minSpinCooldownMs - timeSinceLastAccepted}ms remaining before accepting next spin."
            )
        }

        if (detectedNumber == candidateNumber) {
            candidateFrameCount++
            if (candidateFrameCount >= requiredConsistentFrames) {
                lastAcceptedNumber = detectedNumber
                lastAcceptedTimestamp = now
                candidateNumber = null
                candidateFrameCount = 0

                return FilterResult(
                    status = FilterStatus.ACCEPTED_NEW_SPIN,
                    confirmedNumber = detectedNumber,
                    message = "New spin confirmed: $detectedNumber"
                )
            } else {
                return FilterResult(
                    status = FilterStatus.VERIFYING_CANDIDATE,
                    message = "Verifying frame consistency: $candidateFrameCount/$requiredConsistentFrames"
                )
            }
        } else {
            candidateNumber = detectedNumber
            candidateFrameCount = 1
            return FilterResult(
                status = FilterStatus.VERIFYING_CANDIDATE,
                message = "New candidate detected ($detectedNumber). Verifying consistency..."
            )
        }
    }

    @Synchronized
    fun reset() {
        lastAcceptedNumber = null
        lastAcceptedTimestamp = 0L
        candidateNumber = null
        candidateFrameCount = 0
    }
}`
  },
  {
    name: 'MainActivity.kt',
    path: 'app/src/main/java/com/roulette/ocrpredictor/MainActivity.kt',
    language: 'kotlin',
    description: 'Entry Activity requesting ACTION_MANAGE_OVERLAY_PERMISSION, POST_NOTIFICATIONS, and createScreenCaptureIntent().',
    code: `package com.roulette.ocrpredictor

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

class MainActivity : AppCompatActivity() {

    private lateinit var tvPermissionStatus: TextView
    private lateinit var tvCaptureStatus: TextView
    private lateinit var btnGrantOverlay: Button
    private lateinit var btnStartPredictor: Button
    private lateinit var btnStopPredictor: Button

    private lateinit var mediaProjectionManager: MediaProjectionManager

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

            val overlayIntent = Intent(this, OverlayService::class.java)
            startService(overlayIntent)

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
}`
  }
];
