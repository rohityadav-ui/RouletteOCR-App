package com.roulette.ocrpredictor.model

/**
 * Roulette number color enum.
 */
enum class RouletteColor {
    RED,
    BLACK,
    GREEN_ZERO
}

/**
 * Parity enum.
 */
enum class Parity {
    EVEN,
    ODD,
    NONE
}

/**
 * Dozen section (1st: 1-12, 2nd: 13-24, 3rd: 25-36).
 */
enum class Dozen {
    FIRST,   // 1 - 12
    SECOND,  // 13 - 24
    THIRD,   // 25 - 36
    NONE     // 0
}

/**
 * Column section (Vertical columns on European roulette layout).
 */
enum class Column {
    COL_1, // 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
    COL_2, // 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
    COL_3, // 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
    NONE   // 0
}

/**
 * Range high/low.
 */
enum class HiLo {
    LOW,   // 1 - 18
    HIGH,  // 19 - 36
    NONE   // 0
}

/**
 * Recognized pattern taxonomy for Right-to-Left analysis.
 */
enum class PatternType(val displayName: String) {
    ZIG_ZAG("Zig-Zag (Alternating)"),
    BRACKET("Bracket (A-B-B-A)"),
    COLOR_FLOW("Color Flow (Streak)"),
    FALSE_BREAK("False Break (Snapback)"),
    PATTERN_123("1-2-3 Progression"),
    GROUP_MARCH("Group March (Dozens/Cols)"),
    PATTERN_2X2("2*2 Pair Flow"),
    ZERO_PAUSE("Zero Pause (1 Spin Cooldown)"),
    NONE("Neutral / Calibrating")
}

/**
 * Concrete representation of a roulette wheel outcome.
 */
data class RouletteNumber(
    val value: Int,
    val timestamp: Long = System.currentTimeMillis()
) {
    val color: RouletteColor = when (value) {
        0 -> RouletteColor.GREEN_ZERO
        1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36 -> RouletteColor.RED
        else -> RouletteColor.BLACK
    }

    val parity: Parity = when {
        value == 0 -> Parity.NONE
        value % 2 == 0 -> Parity.EVEN
        else -> Parity.ODD
    }

    val dozen: Dozen = when {
        value == 0 -> Dozen.NONE
        value in 1..12 -> Dozen.FIRST
        value in 13..24 -> Dozen.SECOND
        else -> Dozen.THIRD
    }

    val column: Column = when {
        value == 0 -> Column.NONE
        value % 3 == 1 -> Column.COL_1
        value % 3 == 2 -> Column.COL_2
        else -> Column.COL_3
    }

    val hiLo: HiLo = when {
        value == 0 -> HiLo.NONE
        value in 1..18 -> HiLo.LOW
        else -> HiLo.HIGH
    }
}

/**
 * Output prediction produced by RoulettePatternAnalyzer.
 */
data class PredictionResult(
    val primaryBet: String,
    val patternType: PatternType,
    val confidencePercent: Int,
    val explanation: String,
    val isZeroPaused: Boolean = false,
    val suggestedDozen: String = "--",
    val suggestedColumn: String = "--",
    val suggestedHiLo: String = "--",
    val suggestedEvenOdd: String = "--"
)
