package com.roulette.ocrpredictor.service

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

        // Shared analyzer instance
        val analyzer = RoulettePatternAnalyzer()
    }

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private lateinit var windowParams: WindowManager.LayoutParams

    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())

    // UI View References from overlay_layout.xml
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
        tvConfidenceBadge.text = "CONF: ${prediction.confidencePercent}%"
        tvActivePattern.text = "Pattern: ${prediction.patternType.displayName}"

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

        // Update latest detected spin badge
        val latest = history.first()
        tvLastNumber.text = latest.value.toString()
        val latestBgColor = when (latest.color) {
            RouletteColor.RED -> Color.parseColor("#DC2626")
            RouletteColor.BLACK -> Color.parseColor("#1E293B")
            RouletteColor.GREEN_ZERO -> Color.parseColor("#059669")
        }
        frameLastNumber.background = createCircleDrawable(latestBgColor)

        // Populate Right-To-Left history chips
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
        // Quick popup number picker for manual entry
        val options = (0..36).map { it.toString() }.toTypedArray()
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
}
