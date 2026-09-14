import React, { useState, useRef, useEffect } from 'react';
import {
  GripHorizontal,
  Minus,
  Maximize2,
  X,
  AlertTriangle,
  RotateCcw,
  Crop,
  PlusCircle,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import {
  PredictionState,
  RouletteNumberItem,
  FilterLog,
} from '../types';

interface FloatingHudOverlayProps {
  prediction: PredictionState;
  history: RouletteNumberItem[];
  latestNumber: RouletteNumberItem | null;
  fps: number;
  latestFilterLog: FilterLog | null;
  onReset: () => void;
  onManualAdd: (num: number) => void;
}

export const FloatingHudOverlay: React.FC<FloatingHudOverlayProps> = ({
  prediction,
  history,
  latestNumber,
  fps,
  latestFilterLog,
  onReset,
  onManualAdd,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [showRoiNotice, setShowRoiNotice] = useState(false);

  const hudRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLButtonElement || (e.target as HTMLElement).closest('button')) {
      return;
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 340, e.clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const getNumberColorClass = (color?: string) => {
    if (color === 'RED') return 'bg-red-600 text-white border-red-400';
    if (color === 'BLACK') return 'bg-slate-900 text-slate-100 border-slate-700';
    if (color === 'GREEN_ZERO') return 'bg-emerald-600 text-white border-emerald-400';
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  const getBetColorClass = (bet: string, isZero: boolean) => {
    if (isZero) return 'text-emerald-400';
    if (bet.includes('RED')) return 'text-red-400';
    if (bet.includes('BLACK')) return 'text-slate-200';
    if (bet.includes('DOZEN')) return 'text-amber-300';
    return 'text-sky-400';
  };

  return (
    <div
      id="floating-overlay-hud"
      ref={hudRef}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: 'none',
      }}
      className="fixed top-0 left-0 z-50 w-80 select-none rounded-2xl bg-slate-950/95 p-3.5 shadow-2xl ring-1 ring-slate-800/80 backdrop-blur-md transition-shadow hover:ring-sky-500/50"
    >
      {/* HUD Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        className="flex cursor-grab items-center justify-between rounded-xl bg-slate-900/90 px-3 py-2 active:cursor-grabbing border border-slate-800"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-black tracking-wider text-slate-200">
            ROULETTE OCR HUD
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">
            SCAN
          </span>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            title={isMinimized ? 'Expand HUD' : 'Collapse HUD'}
          >
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main HUD Body */}
      {!isMinimized && (
        <div className="mt-2.5 space-y-2.5">
          {/* Latest Number & Primary Signal Card */}
          <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800/80">
            <div className="flex items-center gap-3">
              {/* Latest Number Circle */}
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl font-black shadow-lg ${getNumberColorClass(
                  latestNumber?.color
                )}`}
              >
                {latestNumber ? latestNumber.value : '--'}
              </div>

              {/* Recommendation Callout */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    NEXT PREDICTION
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                      prediction.confidencePercent >= 80
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    CONF: {prediction.confidencePercent}%
                  </span>
                </div>

                <div
                  className={`truncate text-lg font-black tracking-tight ${getBetColorClass(
                    prediction.primaryBet,
                    prediction.isZeroPaused
                  )}`}
                >
                  {prediction.primaryBet}
                </div>

                <div className="truncate text-[11px] font-medium text-sky-400">
                  {prediction.patternType === 'NONE'
                    ? 'Pattern: Calibrating'
                    : `Pattern: ${prediction.patternType.replace('_', ' ')}`}
                </div>
              </div>
            </div>

            {/* Explanation Note */}
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400 border-t border-slate-800/60 pt-1.5">
              {prediction.explanation}
            </p>
          </div>

          {/* Zero (0) Green Pause Banner */}
          {prediction.isZeroPaused && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-950/80 p-2 text-xs font-semibold text-emerald-300 border border-emerald-700/60">
              <AlertTriangle className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse" />
              <div className="leading-tight">
                <div className="font-bold">ZERO (0) GREEN PAUSE ACTIVE</div>
                <div className="text-[10px] text-emerald-400/90 font-normal">
                  Skipping 1 spin to re-establish reference baseline.
                </div>
              </div>
            </div>
          )}

          {/* Right-to-Left Chronological History Strip */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>RTL HISTORY (Recent &rarr; Past)</span>
              <span className="text-[9px] text-slate-500">{history.length} spins</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-slate-700">
              {history.length === 0 ? (
                <div className="text-[11px] text-slate-600 italic">No spins recorded yet</div>
              ) : (
                history.slice(0, 12).map((item, idx) => (
                  <div
                    key={`${item.value}-${item.timestamp}-${idx}`}
                    title={`Spin #${history.length - idx}: ${item.value} (${item.color})`}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${getNumberColorClass(
                      item.color
                    )}`}
                  >
                    {item.value}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sub-Predictions Grid: Dozen, Column, Hi/Lo, Even/Odd */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-slate-900/90 p-1.5 border border-slate-800/80">
              <div className="text-[9px] text-slate-400 font-medium">DOZEN</div>
              <div className="text-[11px] font-bold text-slate-200 truncate">
                {prediction.suggestedDozen || '--'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/90 p-1.5 border border-slate-800/80">
              <div className="text-[9px] text-slate-400 font-medium">COLUMN</div>
              <div className="text-[11px] font-bold text-slate-200 truncate">
                {prediction.suggestedColumn || '--'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/90 p-1.5 border border-slate-800/80">
              <div className="text-[9px] text-slate-400 font-medium">HI / LO</div>
              <div className="text-[11px] font-bold text-slate-200 truncate">
                {prediction.suggestedHiLo?.replace(' (1-18)', '').replace(' (19-36)', '') || '--'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/90 p-1.5 border border-slate-800/80">
              <div className="text-[9px] text-slate-400 font-medium">EVEN/ODD</div>
              <div className="text-[11px] font-bold text-slate-200 truncate">
                {prediction.suggestedEvenOdd || '--'}
              </div>
            </div>
          </div>

          {/* Duplicate Frame Filter & Speed Diagnostics */}
          <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-800/60 pt-2">
            <div className="flex items-center gap-1.5 truncate max-w-[210px]">
              <ShieldCheck className="h-3 w-3 shrink-0 text-sky-400" />
              <span className="truncate">
                {latestFilterLog?.message || 'Dedup: Filter Armed (7s Cooldown & State Lock)'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 font-mono text-slate-400">
              <Activity className="h-3 w-3 text-emerald-400" />
              <span>{fps.toFixed(1)} fps</span>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              onClick={() => {
                setShowRoiNotice(true);
                setTimeout(() => setShowRoiNotice(false), 2500);
              }}
              className="flex items-center justify-center gap-1 rounded-lg bg-slate-800/90 py-1.5 text-[10px] font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <Crop className="h-3 w-3 text-slate-400" />
              <span>Crop ROI</span>
            </button>

            <button
              onClick={() => setShowManualPicker(!showManualPicker)}
              className="flex items-center justify-center gap-1 rounded-lg bg-slate-800/90 py-1.5 text-[10px] font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <PlusCircle className="h-3 w-3 text-slate-400" />
              <span>+ Manual</span>
            </button>

            <button
              onClick={onReset}
              className="flex items-center justify-center gap-1 rounded-lg bg-red-950/70 py-1.5 text-[10px] font-medium text-red-300 hover:bg-red-900/80 transition"
            >
              <RotateCcw className="h-3 w-3 text-red-400" />
              <span>Reset</span>
            </button>
          </div>

          {/* ROI Toast */}
          {showRoiNotice && (
            <div className="rounded-lg bg-sky-950/90 p-2 text-center text-[10px] text-sky-300 border border-sky-800">
              ROI calibrator active: Android ScreenCaptureService targets top 35% banner.
            </div>
          )}

          {/* Quick Manual Number Picker Popover */}
          {showManualPicker && (
            <div className="rounded-xl bg-slate-900 p-2 border border-slate-700 shadow-xl">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>Select Number (0-36):</span>
                <button
                  onClick={() => setShowManualPicker(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto pr-1">
                {Array.from({ length: 37 }, (_, i) => i).map((n) => {
                  let colorClass = 'bg-slate-800 text-slate-200 hover:bg-slate-700';
                  if (n === 0) colorClass = 'bg-emerald-700 text-white hover:bg-emerald-600';
                  else if (
                    [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)
                  ) {
                    colorClass = 'bg-red-700 text-white hover:bg-red-600';
                  }
                  return (
                    <button
                      key={n}
                      onClick={() => {
                        onManualAdd(n);
                        setShowManualPicker(false);
                      }}
                      className={`rounded py-1 text-center text-xs font-bold transition ${colorClass}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
