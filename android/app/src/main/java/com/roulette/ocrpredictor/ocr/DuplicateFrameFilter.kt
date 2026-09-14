package com.roulette.ocrpredictor.ocr

import android.util.Log

/**
 * Filter that prevents continuous video frames of the same roulette outcome from
 * registering as duplicate spins. Live casino streams display the winning number
 * banner for 10 to 30 seconds during the betting phase.
 *
 * Filter mechanisms:
 * 1. State-locked deduplication (once number N is recorded, identical N is suppressed).
 * 2. Minimum inter-spin refractory window (e.g. 7000ms cooldown).
 * 3. Frame temporal debounce (requires at least 2 consecutive agreeing frames to accept a transition).
 */
class DuplicateFrameFilter(
    private val minSpinCooldownMs: Long = 7000L,
    private val requiredConsistentFrames: Int = 2
) {
    companion object {
        private const val TAG = "DuplicateFrameFilter"
    }

    private var lastAcceptedNumber: Int? = null
    private var lastAcceptedTimestamp: Long = 0L

    // Candidate buffer for temporal debounce
    private var candidateNumber: Int? = null
    private var candidateFrameCount: Int = 0

    /**
     * Filter state.
     */
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

    /**
     * Process an incoming OCR detected raw integer candidate (0..36).
     * Returns FilterResult indicating whether this frame constitutes a legitimate new spin.
     */
    @Synchronized
    fun processFrame(detectedNumber: Int): FilterResult {
        // Validate European Roulette legal range (0 - 36)
        if (detectedNumber !in 0..36) {
            return FilterResult(
                status = FilterStatus.INVALID_RANGE,
                message = "Value $detectedNumber is out of valid roulette bounds (0-36)."
            )
        }

        val now = System.currentTimeMillis()

        // 1. If identical to currently locked number and within reasonable session, suppress
        if (lastAcceptedNumber != null && detectedNumber == lastAcceptedNumber) {
            return FilterResult(
                status = FilterStatus.SUPPRESSED_DUPLICATE_LOCKED,
                message = "Duplicate frame: Number $detectedNumber is still displayed on live casino banner."
            )
        }

        // 2. Cooldown check
        val timeSinceLastAccepted = now - lastAcceptedTimestamp
        if (lastAcceptedNumber != null && timeSinceLastAccepted < minSpinCooldownMs) {
            return FilterResult(
                status = FilterStatus.SUPPRESSED_COOLDOWN_ACTIVE,
                message = "Cooldown active: ${minSpinCooldownMs - timeSinceLastAccepted}ms remaining before accepting next spin."
            )
        }

        // 3. Temporal debounce: Verify across consecutive frames
        if (detectedNumber == candidateNumber) {
            candidateFrameCount++
            if (candidateFrameCount >= requiredConsistentFrames) {
                // Confirmed new spin!
                lastAcceptedNumber = detectedNumber
                lastAcceptedTimestamp = now
                candidateNumber = null
                candidateFrameCount = 0

                Log.d(TAG, "Confirmed new spin: $detectedNumber after $requiredConsistentFrames verified frames.")
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
            // New candidate detected, start verification
            candidateNumber = detectedNumber
            candidateFrameCount = 1
            return FilterResult(
                status = FilterStatus.VERIFYING_CANDIDATE,
                message = "New candidate detected ($detectedNumber). Verifying consistency..."
            )
        }
    }

    /**
     * Force reset filter state (e.g. on manual user override).
     */
    @Synchronized
    fun reset() {
        lastAcceptedNumber = null
        lastAcceptedTimestamp = 0L
        candidateNumber = null
        candidateFrameCount = 0
    }
}
