package com.roulette.ocrpredictor.analyzer

import com.roulette.ocrpredictor.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Core Roulette Pattern Analyzer utilizing Right-to-Left chronological sequence evaluation.
 * Evaluates sequences from the newest spin (t0) backwards through history (t-1, t-2, ...).
 * Handles:
 * - 0 (Green) 1-spin pause
 * - Zig-Zag (Alternating)
 * - Bracket (A-B-B-A sandwich)
 * - Color Flow (Momentum streak)
 * - False Break (Single-spin breach snapback)
 * - 1-2-3 Progression
 * - Group March (Dozens / Columns)
 * - 2*2 (Paired doubles)
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

    // State tracking for Zero (0) 1-spin pause handling
    private var zeroPauseArmed: Boolean = false
    private var zeroPauseSpinCount: Int = 0

    /**
     * Add a newly detected roulette number from OCR / ScreenCapture.
     */
    @Synchronized
    fun addNumber(number: RouletteNumber) {
        val currentList = _history.value.toMutableList()
        currentList.add(0, number) // Prepend so index 0 is always the latest spin (RTL analysis anchor)

        // Keep maximum 60 spins for memory and performance
        if (currentList.size > 60) {
            currentList.removeAt(currentList.lastIndex)
        }
        _history.value = currentList

        // Evaluate predictions with updated history
        evaluatePrediction(currentList)
    }

    /**
     * Clear all spin history and reset zero pause state.
     */
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

    /**
     * Main evaluation engine running Right-to-Left (RTL) chronological analysis.
     * Index 0 is the most recent spin (t0), Index 1 is (t-1), etc.
     */
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

        // If previously armed with zero pause, decrement count
        if (zeroPauseArmed) {
            zeroPauseSpinCount--
            if (zeroPauseSpinCount <= 0) {
                zeroPauseArmed = false // Pause lifted!
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

        // Need at least 3 non-zero spins for reliable pattern detection
        val nonZeroSpins = spins.filter { it.value != 0 }
        if (nonZeroSpins.size < 3) {
            _currentPrediction.value = PredictionResult(
                primaryBet = "OBSERVING",
                patternType = PatternType.NONE,
                confidencePercent = 35,
                explanation = "Collecting baseline: ${nonZeroSpins.size}/3 spins recorded."
            )
            return
        }

        // Extract colors for RTL analysis: c0 is newest, c1 is previous, c2 is t-2, etc.
        val colors = nonZeroSpins.map { it.color }
        val dozens = nonZeroSpins.map { it.dozen }
        val columns = nonZeroSpins.map { it.column }
        val parities = nonZeroSpins.map { it.parity }
        val hiLos = nonZeroSpins.map { it.hiLo }

        // --- PATTERN LOGIC 1: FALSE BREAK (SNAPBACK) ---
        // Pattern: [c0 != c1] but c1 == c2 == c3. A sudden single switch against a dominant flow.
        // e.g. R, R, R then Black appears. Predict immediate snapback to RED.
        if (colors.size >= 4) {
            val c0 = colors[0]
            val c1 = colors[1]
            val c2 = colors[2]
            val c3 = colors[3]
            if (c0 != c1 && c1 == c2 && c2 == c3) {
                val snapbackColor = c1
                val targetName = if (snapbackColor == RouletteColor.RED) "RED" else "BLACK"
                _currentPrediction.value = PredictionResult(
                    primaryBet = "BET $targetName",
                    patternType = PatternType.FALSE_BREAK,
                    confidencePercent = 88,
                    explanation = "False Break detected! Single spin disruption ($c0) against 3x $targetName. Strong snapback expected to $targetName.",
                    suggestedDozen = predictDozenExhaustion(dozens),
                    suggestedColumn = predictColumnExhaustion(columns),
                    suggestedHiLo = hiLos[0].name,
                    suggestedEvenOdd = parities[0].name
                )
                return
            }
        }

        // --- PATTERN LOGIC 2: 2*2 PAIR FLOW ---
        // Pattern: [R, R, B, B] or [B, B, R, R]
        // If c0 == c1, but c1 != c2 and c2 == c3.
        // The last pair (c0, c1) just finished. Predict switch to the opposite color to initiate the new pair!
        if (colors.size >= 4) {
            val c0 = colors[0]
            val c1 = colors[1]
            val c2 = colors[2]
            val c3 = colors[3]
            if (c0 == c1 && c2 == c3 && c0 != c2) {
                val nextColor = c2 // Switch to start the next 2-pair
                val targetName = if (nextColor == RouletteColor.RED) "RED" else "BLACK"
                _currentPrediction.value = PredictionResult(
                    primaryBet = "BET $targetName",
                    patternType = PatternType.PATTERN_2X2,
                    confidencePercent = 85,
                    explanation = "2*2 Pattern confirmed: [${c3.name.take(1)}x2 -> ${c1.name.take(1)}x2]. Predict switch to $targetName to initiate next pair.",
                    suggestedDozen = predictDozenTrend(dozens),
                    suggestedColumn = predictColumnTrend(columns),
                    suggestedHiLo = if (nonZeroSpins[0].hiLo == HiLo.HIGH) "LOW" else "HIGH",
                    suggestedEvenOdd = if (nonZeroSpins[0].parity == Parity.EVEN) "ODD" else "EVEN"
                )
                return
            }
        }

        // --- PATTERN LOGIC 3: BRACKET PATTERN (A-B-B-A SANDWICH) ---
        // Pattern: [c2 = A, c1 = B, c0 = B]. Predict c_next = A to complete the sandwich bracket [A B B A].
        if (colors.size >= 3) {
            val c0 = colors[0]
            val c1 = colors[1]
            val c2 = colors[2]
            if (c0 == c1 && c0 != c2) {
                // If history >= 4 and already A-B-B-A, skip, but if at A-B-B, predict A!
                val targetColor = c2
                val targetName = if (targetColor == RouletteColor.RED) "RED" else "BLACK"
                _currentPrediction.value = PredictionResult(
                    primaryBet = "BET $targetName",
                    patternType = PatternType.BRACKET,
                    confidencePercent = 82,
                    explanation = "Bracket Pattern setup: [${c2.name.take(1)} - ${c1.name.take(1)} - ${c0.name.take(1)}]. Predict outer bracket closure $targetName.",
                    suggestedDozen = predictDozenTrend(dozens),
                    suggestedColumn = predictColumnTrend(columns),
                    suggestedHiLo = hiLos[0].name,
                    suggestedEvenOdd = parities[0].name
                )
                return
            }
        }

        // --- PATTERN LOGIC 4: 1-2-3 PROGRESSION ---
        // Sequence of 1 of Color A, 2 of Color B, 3 of Color A.
        // If history shows 1 A, 2 B, and currently 1 or 2 A: predict next A to complete 3-run!
        if (colors.size >= 5) {
            val c0 = colors[0]
            val c1 = colors[1]
            val c2 = colors[2]
            val c3 = colors[3]
            val c4 = colors[4]
            // Case: [c4=A, c3=B, c2=B, c1=A, c0=A] -> 1 A, 2 B, 2 A so far -> Predict 3rd A!
            if (c4 != c3 && c3 == c2 && c2 != c1 && c1 == c0 && c0 == c4) {
                val targetName = if (c0 == RouletteColor.RED) "RED" else "BLACK"
                _currentPrediction.value = PredictionResult(
                    primaryBet = "BET $targetName",
                    patternType = PatternType.PATTERN_123,
                    confidencePercent = 84,
                    explanation = "1-2-3 Progression: 1x${c4.name.take(1)}, 2x${c3.name.take(1)}, currently 2x${c0.name.take(1)}. Predict 3rd $targetName to complete 1-2-3.",
                    suggestedDozen = predictDozenTrend(dozens),
                    suggestedColumn = predictColumnTrend(columns),
                    suggestedHiLo = hiLos[0].name,
                    suggestedEvenOdd = parities[0].name
                )
                return
            }
        }

        // --- PATTERN LOGIC 5: ZIG-ZAG (ALTERNATING FLOW) ---
        // Alternating color sequence: e.g. R -> B -> R -> B (length >= 3)
        var zigZagCount = 1
        for (i in 0 until colors.size - 1) {
            if (colors[i] != colors[i + 1]) {
                zigZagCount++
            } else {
                break
            }
        }
        if (zigZagCount >= 3) {
            // Continuation of alternating pattern: if newest is Red, predict Black, and vice versa
            val nextColor = if (colors[0] == RouletteColor.RED) RouletteColor.BLACK else RouletteColor.RED
            val targetName = if (nextColor == RouletteColor.RED) "RED" else "BLACK"
            val conf = (70 + (zigZagCount * 4)).coerceAtMost(92)
            _currentPrediction.value = PredictionResult(
                primaryBet = "BET $targetName",
                patternType = PatternType.ZIG_ZAG,
                confidencePercent = conf,
                explanation = "Zig-Zag Alternating Wave ($zigZagCount-streak): ${colors[0].name.take(1)} landed, predict wave continuation to $targetName.",
                suggestedDozen = predictDozenTrend(dozens),
                suggestedColumn = predictColumnTrend(columns),
                suggestedHiLo = if (nonZeroSpins[0].hiLo == HiLo.HIGH) "LOW" else "HIGH",
                suggestedEvenOdd = if (nonZeroSpins[0].parity == Parity.EVEN) "ODD" else "EVEN"
            )
            return
        }

        // --- PATTERN LOGIC 6: GROUP MARCH (DOZENS / COLUMNS PROGRESSION) ---
        // E.g., Dozens moving 1st -> 2nd -> 3rd or 3rd -> 2nd -> 1st
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

        // --- PATTERN LOGIC 7: COLOR FLOW (STREAK MOMENTUM) ---
        // 3 or more consecutive identical colors
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
                explanation = "Color Flow Streak (${streakCount}x $targetName in a row): Strong momentum flow, predict continuation.",
                suggestedDozen = predictDozenTrend(dozens),
                suggestedColumn = predictColumnTrend(columns),
                suggestedHiLo = hiLos[0].name,
                suggestedEvenOdd = parities[0].name
            )
            return
        }

        // Fallback default balanced heuristic
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
        // Predict the coldest / overdue dozen
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
}
