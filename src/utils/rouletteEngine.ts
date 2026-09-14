import {
  RouletteColor,
  Parity,
  Dozen,
  Column,
  HiLo,
  PatternType,
  RouletteNumberItem,
  PredictionState,
  FilterStatus,
} from '../types';

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function createRouletteNumber(val: number): RouletteNumberItem {
  let color: RouletteColor = 'BLACK';
  if (val === 0) color = 'GREEN_ZERO';
  else if (RED_NUMBERS.has(val)) color = 'RED';

  const parity: Parity = val === 0 ? 'NONE' : val % 2 === 0 ? 'EVEN' : 'ODD';
  const dozen: Dozen =
    val === 0
      ? 'NONE'
      : val <= 12
      ? '1st Dozen'
      : val <= 24
      ? '2nd Dozen'
      : '3rd Dozen';

  const column: Column =
    val === 0
      ? 'NONE'
      : val % 3 === 1
      ? 'Col 1'
      : val % 3 === 2
      ? 'Col 2'
      : 'Col 3';

  const hiLo: HiLo =
    val === 0 ? 'NONE' : val <= 18 ? 'LOW (1-18)' : 'HIGH (19-36)';

  return {
    value: val,
    color,
    parity,
    dozen,
    column,
    hiLo,
    timestamp: Date.now(),
  };
}

export class DuplicateFilterEngine {
  private lastAcceptedNumber: number | null = null;
  private lastAcceptedTimestamp: number = 0;
  private candidateNumber: number | null = null;
  private candidateCount: number = 0;
  private minCooldownMs: number = 7000;
  private requiredFrames: number = 2;

  constructor(cooldownMs = 7000, requiredFrames = 2) {
    this.minCooldownMs = cooldownMs;
    this.requiredFrames = requiredFrames;
  }

  processFrame(detected: number): {
    status: FilterStatus;
    confirmedNumber: number | null;
    message: string;
  } {
    if (detected < 0 || detected > 36) {
      return {
        status: 'INVALID_RANGE',
        confirmedNumber: null,
        message: `Value ${detected} out of legal roulette bounds (0-36).`,
      };
    }

    const now = Date.now();

    // If identical to last accepted number, suppress locked frame
    if (this.lastAcceptedNumber !== null && detected === this.lastAcceptedNumber) {
      return {
        status: 'SUPPRESSED_DUPLICATE_LOCKED',
        confirmedNumber: null,
        message: `Duplicate frame: #${detected} matches active locked banner.`,
      };
    }

    // Cooldown check
    const elapsed = now - this.lastAcceptedTimestamp;
    if (this.lastAcceptedNumber !== null && elapsed < this.minCooldownMs) {
      const remain = Math.ceil((this.minCooldownMs - elapsed) / 1000);
      return {
        status: 'SUPPRESSED_COOLDOWN_ACTIVE',
        confirmedNumber: null,
        message: `Refractory cooldown active: ${remain}s remaining.`,
      };
    }

    // Multi-frame verification
    if (detected === this.candidateNumber) {
      this.candidateCount++;
      if (this.candidateCount >= this.requiredFrames) {
        this.lastAcceptedNumber = detected;
        this.lastAcceptedTimestamp = now;
        this.candidateNumber = null;
        this.candidateCount = 0;
        return {
          status: 'ACCEPTED_NEW_SPIN',
          confirmedNumber: detected,
          message: `New spin confirmed: #${detected} verified across ${this.requiredFrames} frames.`,
        };
      } else {
        return {
          status: 'VERIFYING_CANDIDATE',
          confirmedNumber: null,
          message: `Debouncing frame consistency (${this.candidateCount}/${this.requiredFrames})...`,
        };
      }
    } else {
      this.candidateNumber = detected;
      this.candidateCount = 1;
      return {
        status: 'VERIFYING_CANDIDATE',
        confirmedNumber: null,
        message: `Candidate #${detected} detected. Verifying frame stability...`,
      };
    }
  }

  reset() {
    this.lastAcceptedNumber = null;
    this.lastAcceptedTimestamp = 0;
    this.candidateNumber = null;
    this.candidateCount = 0;
  }
}

/**
 * Evaluates predictions using Right-to-Left (RTL) chronological analysis.
 * Index 0 in history is the most recent spin (t0).
 */
export function evaluatePredictions(
  history: RouletteNumberItem[],
  zeroPauseActive: boolean
): { prediction: PredictionState; zeroPauseNext: boolean } {
  if (history.length === 0) {
    return {
      prediction: {
        primaryBet: 'READY / WAITING',
        patternType: 'NONE',
        confidencePercent: 0,
        explanation: 'Awaiting casino stream input. Need >= 3 spins.',
        isZeroPaused: false,
        suggestedDozen: '--',
        suggestedColumn: '--',
        suggestedHiLo: '--',
        suggestedEvenOdd: '--',
      },
      zeroPauseNext: false,
    };
  }

  const latest = history[0];

  // 1. Zero (0) Green Handling: 1 spin pause
  if (latest.value === 0) {
    return {
      prediction: {
        primaryBet: 'PAUSE / NO BET',
        patternType: 'ZERO_PAUSE',
        confidencePercent: 100,
        explanation: 'Zero (0) Green landed! Pausing 1 spin to re-establish reference baseline.',
        isZeroPaused: true,
        suggestedDozen: '--',
        suggestedColumn: '--',
        suggestedHiLo: '--',
        suggestedEvenOdd: '--',
      },
      zeroPauseNext: true,
    };
  }

  if (zeroPauseActive) {
    // Current spin lifted the pause, next spin can resume prediction
    // But for this current spin, we re-baseline
    return {
      prediction: {
        primaryBet: 'RE-BASELINING',
        patternType: 'ZERO_PAUSE',
        confidencePercent: 85,
        explanation: '1-spin zero pause completed. Reference baseline re-established with #' + latest.value + '.',
        isZeroPaused: false,
        suggestedDozen: latest.dozen,
        suggestedColumn: latest.column,
        suggestedHiLo: latest.hiLo,
        suggestedEvenOdd: latest.parity,
      },
      zeroPauseNext: false,
    };
  }

  const nonZero = history.filter((s) => s.value !== 0);
  if (nonZero.length < 3) {
    return {
      prediction: {
        primaryBet: 'OBSERVING',
        patternType: 'NONE',
        confidencePercent: 40,
        explanation: `Collecting baseline sequence: ${nonZero.length}/3 spins recorded.`,
        isZeroPaused: false,
        suggestedDozen: latest.dozen,
        suggestedColumn: latest.column,
        suggestedHiLo: latest.hiLo,
        suggestedEvenOdd: latest.parity,
      },
      zeroPauseNext: false,
    };
  }

  const colors = nonZero.map((s) => s.color);
  const dozens = nonZero.map((s) => s.dozen);
  const columns = nonZero.map((s) => s.column);
  const parities = nonZero.map((s) => s.parity);
  const hiLos = nonZero.map((s) => s.hiLo);

  // --- PATTERN 1: FALSE BREAK (SNAPBACK) ---
  // [c0 != c1] but c1 == c2 == c3.
  if (colors.length >= 4) {
    const [c0, c1, c2, c3] = colors;
    if (c0 !== c1 && c1 === c2 && c2 === c3) {
      const snapbackColor = c1;
      return {
        prediction: {
          primaryBet: `BET ${snapbackColor}`,
          patternType: 'FALSE_BREAK',
          confidencePercent: 89,
          explanation: `False Break detected! Single-spin interruption (${c0}) against 3x ${c1}. Strong snapback expected to ${snapbackColor}.`,
          isZeroPaused: false,
          suggestedDozen: getDozenCold(dozens),
          suggestedColumn: getColumnCold(columns),
          suggestedHiLo: hiLos[0],
          suggestedEvenOdd: parities[0],
        },
        zeroPauseNext: false,
      };
    }
  }

  // --- PATTERN 2: 2*2 PAIR FLOW ---
  // c0 == c1 and c2 == c3 and c0 != c2
  if (colors.length >= 4) {
    const [c0, c1, c2, c3] = colors;
    if (c0 === c1 && c2 === c3 && c0 !== c2) {
      const nextColor = c2;
      return {
        prediction: {
          primaryBet: `BET ${nextColor}`,
          patternType: 'PATTERN_2X2',
          confidencePercent: 86,
          explanation: `2*2 Pair Pattern confirmed: [${c3}x2 -> ${c1}x2]. Predict switch to ${nextColor} to launch next pair.`,
          isZeroPaused: false,
          suggestedDozen: getDozenTrend(dozens),
          suggestedColumn: getColumnTrend(columns),
          suggestedHiLo: hiLos[0] === 'HIGH (19-36)' ? 'LOW (1-18)' : 'HIGH (19-36)',
          suggestedEvenOdd: parities[0] === 'EVEN' ? 'ODD' : 'EVEN',
        },
        zeroPauseNext: false,
      };
    }
  }

  // --- PATTERN 3: BRACKET PATTERN (A-B-B-A SANDWICH) ---
  // c0 == c1 and c0 != c2 -> Predict c2 to close outer bracket [A B B A]
  if (colors.length >= 3) {
    const [c0, c1, c2] = colors;
    if (c0 === c1 && c0 !== c2) {
      const targetColor = c2;
      return {
        prediction: {
          primaryBet: `BET ${targetColor}`,
          patternType: 'BRACKET',
          confidencePercent: 83,
          explanation: `Bracket Pattern setup: [${c2} - ${c1} - ${c0}]. Predict outer bracket closure to ${targetColor}.`,
          isZeroPaused: false,
          suggestedDozen: getDozenTrend(dozens),
          suggestedColumn: getColumnTrend(columns),
          suggestedHiLo: hiLos[0],
          suggestedEvenOdd: parities[0],
        },
        zeroPauseNext: false,
      };
    }
  }

  // --- PATTERN 4: 1-2-3 PROGRESSION ---
  if (colors.length >= 5) {
    const [c0, c1, c2, c3, c4] = colors;
    if (c4 !== c3 && c3 === c2 && c2 !== c1 && c1 === c0 && c0 === c4) {
      const target = c0;
      return {
        prediction: {
          primaryBet: `BET ${target}`,
          patternType: 'PATTERN_123',
          confidencePercent: 85,
          explanation: `1-2-3 Progression active: 1x${c4}, 2x${c3}, 2x${c0} so far. Predict 3rd ${target} to complete sequence.`,
          isZeroPaused: false,
          suggestedDozen: getDozenTrend(dozens),
          suggestedColumn: getColumnTrend(columns),
          suggestedHiLo: hiLos[0],
          suggestedEvenOdd: parities[0],
        },
        zeroPauseNext: false,
      };
    }
  }

  // --- PATTERN 5: ZIG-ZAG (ALTERNATING FLOW) ---
  let zigZagLen = 1;
  for (let i = 0; i < colors.length - 1; i++) {
    if (colors[i] !== colors[i + 1]) {
      zigZagLen++;
    } else {
      break;
    }
  }
  if (zigZagLen >= 3) {
    const nextColor = colors[0] === 'RED' ? 'BLACK' : 'RED';
    const conf = Math.min(92, 70 + zigZagLen * 4);
    return {
      prediction: {
        primaryBet: `BET ${nextColor}`,
        patternType: 'ZIG_ZAG',
        confidencePercent: conf,
        explanation: `Zig-Zag Wave (${zigZagLen}-streak alternating): Last was ${colors[0]}, predict continuation to ${nextColor}.`,
        isZeroPaused: false,
        suggestedDozen: getDozenTrend(dozens),
        suggestedColumn: getColumnTrend(columns),
        suggestedHiLo: hiLos[0] === 'HIGH (19-36)' ? 'LOW (1-18)' : 'HIGH (19-36)',
        suggestedEvenOdd: parities[0] === 'EVEN' ? 'ODD' : 'EVEN',
      },
      zeroPauseNext: false,
    };
  }

  // --- PATTERN 6: GROUP MARCH (DOZENS PROGRESSION) ---
  if (dozens.length >= 3) {
    const [d0, d1, d2] = dozens;
    if (d2 === '1st Dozen' && d1 === '2nd Dozen' && d0 === '3rd Dozen') {
      return {
        prediction: {
          primaryBet: '1st DOZEN (RESET)',
          patternType: 'GROUP_MARCH',
          confidencePercent: 80,
          explanation: 'Ascending Dozen March (D1 -> D2 -> D3) completed. Predict loop reset to 1st Dozen.',
          isZeroPaused: false,
          suggestedDozen: '1st Dozen',
          suggestedColumn: getColumnTrend(columns),
          suggestedHiLo: 'LOW (1-18)',
          suggestedEvenOdd: parities[0],
        },
        zeroPauseNext: false,
      };
    } else if (d2 === '3rd Dozen' && d1 === '2nd Dozen' && d0 === '1st Dozen') {
      return {
        prediction: {
          primaryBet: '3rd DOZEN (RESET)',
          patternType: 'GROUP_MARCH',
          confidencePercent: 80,
          explanation: 'Descending Dozen March (D3 -> D2 -> D1) completed. Predict loop reset to 3rd Dozen.',
          isZeroPaused: false,
          suggestedDozen: '3rd Dozen',
          suggestedColumn: getColumnTrend(columns),
          suggestedHiLo: 'HIGH (19-36)',
          suggestedEvenOdd: parities[0],
        },
        zeroPauseNext: false,
      };
    }
  }

  // --- PATTERN 7: COLOR FLOW (STREAK MOMENTUM) ---
  let streakLen = 1;
  for (let i = 0; i < colors.length - 1; i++) {
    if (colors[i] === colors[i + 1]) {
      streakLen++;
    } else {
      break;
    }
  }
  if (streakLen >= 3) {
    const dominant = colors[0];
    const conf = Math.min(90, 72 + streakLen * 3);
    return {
      prediction: {
        primaryBet: `BET ${dominant}`,
        patternType: 'COLOR_FLOW',
        confidencePercent: conf,
        explanation: `Color Flow Streak (${streakLen}x ${dominant} in a row): Strong momentum, ride the trend.`,
        isZeroPaused: false,
        suggestedDozen: getDozenTrend(dozens),
        suggestedColumn: getColumnTrend(columns),
        suggestedHiLo: hiLos[0],
        suggestedEvenOdd: parities[0],
      },
      zeroPauseNext: false,
    };
  }

  // Fallback: balanced micro-trend
  const redCount = colors.slice(0, 6).filter((c) => c === 'RED').length;
  const blackCount = colors.slice(0, 6).filter((c) => c === 'BLACK').length;
  const target = redCount > blackCount ? 'RED' : 'BLACK';
  return {
    prediction: {
      primaryBet: `BET ${target}`,
      patternType: 'NONE',
      confidencePercent: 62,
      explanation: `Recent 6 spins ratio: Red=${redCount}, Black=${blackCount}. Micro-bias to ${target}.`,
      isZeroPaused: false,
      suggestedDozen: getDozenTrend(dozens),
      suggestedColumn: getColumnTrend(columns),
      suggestedHiLo: hiLos[0],
      suggestedEvenOdd: parities[0],
    },
    zeroPauseNext: false,
  };
}

function getDozenTrend(dozens: Dozen[]): string {
  const d1 = dozens.filter((d) => d === '1st Dozen').length;
  const d2 = dozens.filter((d) => d === '2nd Dozen').length;
  const d3 = dozens.filter((d) => d === '3rd Dozen').length;
  if (d1 >= d2 && d1 >= d3) return '1st Dozen (1-12)';
  if (d2 >= d1 && d2 >= d3) return '2nd Dozen (13-24)';
  return '3rd Dozen (25-36)';
}

function getDozenCold(dozens: Dozen[]): string {
  const d1 = dozens.filter((d) => d === '1st Dozen').length;
  const d2 = dozens.filter((d) => d === '2nd Dozen').length;
  const d3 = dozens.filter((d) => d === '3rd Dozen').length;
  if (d1 <= d2 && d1 <= d3) return '1st Dozen (Overdue)';
  if (d2 <= d1 && d2 <= d3) return '2nd Dozen (Overdue)';
  return '3rd Dozen (Overdue)';
}

function getColumnTrend(columns: Column[]): string {
  const c1 = columns.filter((c) => c === 'Col 1').length;
  const c2 = columns.filter((c) => c === 'Col 2').length;
  const c3 = columns.filter((c) => c === 'Col 3').length;
  if (c1 >= c2 && c1 >= c3) return 'Col 1';
  if (c2 >= c1 && c2 >= c3) return 'Col 2';
  return 'Col 3';
}

function getColumnCold(columns: Column[]): string {
  const c1 = columns.filter((c) => c === 'Col 1').length;
  const c2 = columns.filter((c) => c === 'Col 2').length;
  const c3 = columns.filter((c) => c === 'Col 3').length;
  if (c1 <= c2 && c1 <= c3) return 'Col 1 (Overdue)';
  if (c2 <= c1 && c2 <= c3) return 'Col 2 (Overdue)';
  return 'Col 3 (Overdue)';
}
