export type RouletteColor = 'RED' | 'BLACK' | 'GREEN_ZERO';
export type Parity = 'EVEN' | 'ODD' | 'NONE';
export type Dozen = '1st Dozen' | '2nd Dozen' | '3rd Dozen' | 'NONE';
export type Column = 'Col 1' | 'Col 2' | 'Col 3' | 'NONE';
export type HiLo = 'LOW (1-18)' | 'HIGH (19-36)' | 'NONE';

export type PatternType =
  | 'ZIG_ZAG'
  | 'BRACKET'
  | 'COLOR_FLOW'
  | 'FALSE_BREAK'
  | 'PATTERN_123'
  | 'GROUP_MARCH'
  | 'PATTERN_2X2'
  | 'ZERO_PAUSE'
  | 'NONE';

export interface RouletteNumberItem {
  value: number;
  color: RouletteColor;
  parity: Parity;
  dozen: Dozen;
  column: Column;
  hiLo: HiLo;
  timestamp: number;
}

export interface PredictionState {
  primaryBet: string;
  patternType: PatternType;
  confidencePercent: number;
  explanation: string;
  isZeroPaused: boolean;
  suggestedDozen: string;
  suggestedColumn: string;
  suggestedHiLo: string;
  suggestedEvenOdd: string;
}

export type FilterStatus =
  | 'ACCEPTED_NEW_SPIN'
  | 'SUPPRESSED_DUPLICATE_LOCKED'
  | 'SUPPRESSED_COOLDOWN_ACTIVE'
  | 'VERIFYING_CANDIDATE'
  | 'INVALID_RANGE';

export interface FilterLog {
  id: string;
  timestamp: number;
  detectedNumber: number;
  status: FilterStatus;
  message: string;
}

export interface AndroidCodeFile {
  name: string;
  path: string;
  language: 'kotlin' | 'xml' | 'groovy';
  description: string;
  code: string;
}
