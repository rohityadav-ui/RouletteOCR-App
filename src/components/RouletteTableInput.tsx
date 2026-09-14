import React from 'react';
import {
  Sparkles,
  Zap,
  ShieldAlert,
  ListOrdered,
  Shuffle,
  GitBranch,
  Split,
  CircleDot,
  RefreshCcw,
} from 'lucide-react';
import { RED_NUMBERS } from '../utils/rouletteEngine';

interface RouletteTableInputProps {
  onAddNumber: (num: number) => void;
  onRunPreset: (numbers: number[], patternName: string) => void;
  onClear: () => void;
}

export const RouletteTableInput: React.FC<RouletteTableInputProps> = ({
  onAddNumber,
  onRunPreset,
  onClear,
}) => {
  // Preset test patterns
  const presets = [
    {
      name: 'Zig-Zag (Alternating)',
      icon: Shuffle,
      description: 'R-B-R-B alternating wave sequence',
      numbers: [32, 15, 19, 4], // Red 32, Black 15, Red 19, Black 4
      color: 'border-sky-500/50 hover:bg-sky-500/10 text-sky-400',
    },
    {
      name: 'Bracket (A-B-B-A)',
      icon: Split,
      description: 'Red, Black, Black -> Predicts Red closure',
      numbers: [1, 20, 24], // Red 1, Black 20, Black 24
      color: 'border-purple-500/50 hover:bg-purple-500/10 text-purple-400',
    },
    {
      name: 'Color Flow (Streak)',
      icon: Zap,
      description: '4x consecutive Reds riding momentum',
      numbers: [7, 12, 3, 36], // Red 7, Red 12, Red 3, Red 36
      color: 'border-red-500/50 hover:bg-red-500/10 text-red-400',
    },
    {
      name: 'False Break (Snapback)',
      icon: GitBranch,
      description: '3x Red, 1x Black -> Snapback to Red',
      numbers: [14, 9, 18, 2], // Red 14, Red 9, Red 18, Black 2
      color: 'border-amber-500/50 hover:bg-amber-500/10 text-amber-400',
    },
    {
      name: '1-2-3 Progression',
      icon: ListOrdered,
      description: '1 Red, 2 Black, 2 Red -> Predict 3rd Red',
      numbers: [1, 2, 4, 3, 5], // 1R, 2B, 4B, 3R, 5R
      color: 'border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400',
    },
    {
      name: 'Group March (Dozens)',
      icon: Sparkles,
      description: '1st Dozen -> 2nd Dozen -> 3rd Dozen',
      numbers: [5, 17, 29], // D1 5, D2 17, D3 29
      color: 'border-blue-500/50 hover:bg-blue-500/10 text-blue-400',
    },
    {
      name: '2*2 Pair Flow',
      icon: Split,
      description: '2 Red, 2 Black -> Predict switch to Red',
      numbers: [1, 3, 2, 4], // R1, R3, B2, B4
      color: 'border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400',
    },
    {
      name: 'Zero (0) 1-Spin Pause',
      icon: ShieldAlert,
      description: 'Hit 0 Green -> Arms 1 spin pause lock',
      numbers: [0],
      color: 'border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-300',
    },
  ];

  // 3-column European grid layout
  // Column 3 (top row): 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
  // Column 2 (mid row): 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
  // Column 1 (bot row): 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
  const rowCol3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
  const rowCol2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
  const rowCol1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

  const renderCell = (n: number) => {
    const isRed = RED_NUMBERS.has(n);
    const bgClass = isRed
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700';

    return (
      <button
        key={n}
        onClick={() => onAddNumber(n)}
        className={`flex h-10 w-full items-center justify-center rounded-lg text-sm font-black shadow-sm transition active:scale-95 ${bgClass}`}
        title={`Add #${n} (${isRed ? 'RED' : 'BLACK'})`}
      >
        {n}
      </button>
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 p-5 ring-1 ring-slate-800 backdrop-blur-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-sky-400" />
            European Roulette Interactive Board &amp; Pattern Sandbox
          </h3>
          <p className="text-xs text-slate-400">
            Click any table number or run automated sequence presets to benchmark the RTL analyzer.
          </p>
        </div>

        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          <RefreshCcw className="h-3.5 w-3.5 text-slate-400" />
          <span>Clear Board History</span>
        </button>
      </div>

      {/* Preset Pattern Buttons */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          Instant Pattern Benchmark Presets (All 7 Logics + Zero Pause)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {presets.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.name}
                onClick={() => onRunPreset(p.numbers, p.name)}
                className={`flex flex-col items-start rounded-xl border bg-slate-950/60 p-2.5 text-left transition hover:scale-[1.02] ${p.color}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-200">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400 leading-tight">
                  {p.description}
                </div>
                <div className="mt-2 text-[9px] font-mono font-bold text-slate-500">
                  Sequence: [{p.numbers.join(', ')}]
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* European Roulette Table Grid */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          European Roulette Table Layout (0 - 36)
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[580px] flex items-stretch gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
            {/* Zero Green Column */}
            <button
              onClick={() => onAddNumber(0)}
              className="flex w-16 items-center justify-center rounded-xl bg-emerald-700 text-lg font-black text-white hover:bg-emerald-600 transition shadow-lg active:scale-95 border-2 border-emerald-500"
              title="Add #0 Green (Triggers 1-spin pause)"
            >
              0
            </button>

            {/* Main 12x3 Grid */}
            <div className="flex-1 space-y-1.5">
              {/* Row 3 (Col 3) */}
              <div className="grid grid-cols-12 gap-1.5">{rowCol3.map(renderCell)}</div>
              {/* Row 2 (Col 2) */}
              <div className="grid grid-cols-12 gap-1.5">{rowCol2.map(renderCell)}</div>
              {/* Row 1 (Col 1) */}
              <div className="grid grid-cols-12 gap-1.5">{rowCol1.map(renderCell)}</div>
            </div>
          </div>
        </div>

        {/* Outer Bets Quick Taps */}
        <div className="mt-2.5 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs font-bold text-slate-300">
          <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">1st Dozen</span>
            1 to 12
          </div>
          <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">2nd Dozen</span>
            13 to 24
          </div>
          <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">3rd Dozen</span>
            25 to 36
          </div>
          <div className="rounded-lg bg-red-950/40 p-2 border border-red-900/50 text-red-300">
            <span className="text-[10px] text-red-500/80 block">Color</span>
            RED (18)
          </div>
          <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800 text-slate-300">
            <span className="text-[10px] text-slate-500 block">Color</span>
            BLACK (18)
          </div>
          <div className="rounded-lg bg-emerald-950/40 p-2 border border-emerald-900/50 text-emerald-300">
            <span className="text-[10px] text-emerald-500/80 block">House</span>
            ZERO (0)
          </div>
        </div>
      </div>
    </div>
  );
};
