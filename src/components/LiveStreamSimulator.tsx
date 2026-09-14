import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Repeat,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Timer,
  ScanLine,
} from 'lucide-react';
import { FilterLog, RouletteNumberItem } from '../types';

interface LiveStreamSimulatorProps {
  onFeedOcrFrame: (num: number) => void;
  latestNumber: RouletteNumberItem | null;
  filterLogs: FilterLog[];
}

export const LiveStreamSimulator: React.FC<LiveStreamSimulatorProps> = ({
  onFeedOcrFrame,
  latestNumber,
  filterLogs,
}) => {
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [currentStreamNumber, setCurrentStreamNumber] = useState<number>(17);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [burstActive, setBurstActive] = useState(false);
  const [burstCount, setBurstCount] = useState(0);

  const autoSpinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const duplicateBurstTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wheel animation rotation
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setWheelAngle((prev) => (prev + 0.4) % 360);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Auto spin loop: updates number every 8 seconds, but continuously feeds duplicate frames every 500ms
  useEffect(() => {
    if (!isAutoSpinning) {
      if (autoSpinTimerRef.current) clearInterval(autoSpinTimerRef.current);
      return;
    }

    // Continuous video frames at 2 fps
    const frameInterval = setInterval(() => {
      onFeedOcrFrame(currentStreamNumber);
    }, 500);

    // New roulette spin every 9 seconds
    const spinInterval = setInterval(() => {
      const nextNum = Math.floor(Math.random() * 37);
      setCurrentStreamNumber(nextNum);
    }, 9000);

    return () => {
      clearInterval(frameInterval);
      clearInterval(spinInterval);
    };
  }, [isAutoSpinning, currentStreamNumber, onFeedOcrFrame]);

  // Burst duplicate frame tester (simulate 15 rapid frames of same number)
  const triggerDuplicateBurst = (num: number) => {
    setBurstActive(true);
    setBurstCount(0);
    setCurrentStreamNumber(num);

    let count = 0;
    const interval = setInterval(() => {
      count++;
      setBurstCount(count);
      onFeedOcrFrame(num);

      if (count >= 12) {
        clearInterval(interval);
        setBurstActive(false);
      }
    }, 250);

    duplicateBurstTimerRef.current = interval;
  };

  const getLogBadge = (status: FilterLog['status']) => {
    switch (status) {
      case 'ACCEPTED_NEW_SPIN':
        return (
          <span className="flex items-center gap-1 rounded bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 ring-1 ring-emerald-600/50">
            <CheckCircle2 className="h-2.5 w-2.5" /> ACCEPTED SPIN
          </span>
        );
      case 'SUPPRESSED_DUPLICATE_LOCKED':
        return (
          <span className="flex items-center gap-1 rounded bg-amber-950/70 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 ring-1 ring-amber-600/40">
            <Repeat className="h-2.5 w-2.5" /> DEDUP LOCKED
          </span>
        );
      case 'SUPPRESSED_COOLDOWN_ACTIVE':
        return (
          <span className="flex items-center gap-1 rounded bg-sky-950/80 px-1.5 py-0.5 text-[9px] font-bold text-sky-300 ring-1 ring-sky-600/40">
            <Timer className="h-2.5 w-2.5" /> COOLDOWN 7s
          </span>
        );
      case 'VERIFYING_CANDIDATE':
        return (
          <span className="flex items-center gap-1 rounded bg-indigo-950/80 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300 ring-1 ring-indigo-600/40">
            <ScanLine className="h-2.5 w-2.5" /> VERIFYING (2 FRAMES)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
            <AlertCircle className="h-2.5 w-2.5" /> IGNORED
          </span>
        );
    }
  };

  const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(
    currentStreamNumber
  );
  const streamNumberColor =
    currentStreamNumber === 0 ? 'bg-emerald-600' : isRed ? 'bg-red-600' : 'bg-slate-900';

  return (
    <div className="rounded-2xl bg-slate-900/80 p-5 ring-1 ring-slate-800 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-emerald-400" />
            Live Casino Video Stream &amp; OCR Capture
          </h3>
          <p className="text-xs text-slate-400">
            Simulates live roulette video broadcast with continuous frames &amp; OCR ROI scanner.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoSpinning(!isAutoSpinning)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
              isAutoSpinning
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {isAutoSpinning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isAutoSpinning ? 'Pause Stream' : 'Start Auto Stream'}</span>
          </button>

          <button
            onClick={() => triggerDuplicateBurst(currentStreamNumber)}
            disabled={burstActive}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600/90 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
            title="Simulate 12 duplicate frames at 4 fps to test the duplicate frame filter"
          >
            <Repeat className="h-3.5 w-3.5" />
            <span>{burstActive ? `Burst: ${burstCount}/12` : 'Test Duplicate Burst'}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Stream Canvas Display */}
        <div className="relative overflow-hidden rounded-xl bg-slate-950 border border-slate-800 p-4 lg:col-span-7 flex flex-col justify-between min-h-[260px]">
          {/* Top Live Casino Status Bar */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
              <span className="font-bold text-red-400 uppercase tracking-wide text-[10px]">
                LIVE CASINO FEED
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                1080p @ 60fps
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              TABLE: ROULETTE #04
            </div>
          </div>

          {/* Center Wheel Simulation & OCR ROI Overlay */}
          <div className="my-3 relative flex items-center justify-center">
            {/* Spinning Wheel Graphic */}
            <div
              style={{ transform: `rotate(${wheelAngle}deg)` }}
              className="h-36 w-36 rounded-full border-4 border-amber-600/40 bg-radial from-slate-800 via-slate-900 to-black shadow-2xl flex items-center justify-center transition-transform"
            >
              <div className="h-28 w-28 rounded-full border-2 border-dashed border-amber-500/50 flex items-center justify-center">
                <div className="h-14 w-14 rounded-full bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-[10px] font-black text-amber-300">
                  WHEEL
                </div>
              </div>
            </div>

            {/* Simulated Live Winning Number Banner (ROI Area) */}
            <div className="absolute top-2 right-2 rounded-xl bg-black/90 p-2.5 ring-2 ring-emerald-500 shadow-xl flex items-center gap-3">
              {/* ROI scanner crosshair marker */}
              <div className="absolute -top-2 -left-2 bg-emerald-500 text-slate-950 text-[8px] font-black px-1 rounded uppercase tracking-wider">
                OCR ROI CROP
              </div>

              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-black text-white shadow-inner border border-white/20 ${streamNumberColor}`}
              >
                {currentStreamNumber}
              </div>

              <div className="pr-1 text-left">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">
                  WINNING NUMBER
                </div>
                <div className="text-xs font-bold text-slate-200">
                  {currentStreamNumber === 0
                    ? 'ZERO (GREEN)'
                    : isRed
                    ? `${currentStreamNumber} RED`
                    : `${currentStreamNumber} BLACK`}
                </div>
                <div className="text-[9px] text-slate-400">
                  ML Kit Confidence: 99.4%
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Stream Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
            <div>
              Active Frame:{' '}
              <span className="font-mono font-bold text-slate-200">
                #{currentStreamNumber}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onFeedOcrFrame(currentStreamNumber)}
                className="rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                Emit 1 Video Frame
              </button>
              <button
                onClick={() => {
                  const r = Math.floor(Math.random() * 37);
                  setCurrentStreamNumber(r);
                  onFeedOcrFrame(r);
                }}
                className="rounded bg-sky-950 px-2 py-1 text-[10px] font-medium text-sky-300 hover:bg-sky-900 transition"
              >
                New Random Spin
              </button>
            </div>
          </div>
        </div>

        {/* Duplicate Filter Logs & State Machine */}
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-sky-400" />
                Duplicate Frame Filter Engine
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Temporal Debounce: 2 Frames | Cooldown: 7s
              </span>
            </div>

            {/* Filter Explanation */}
            <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
              In real live casino streams, the winning number stays visible for 15+ seconds.
              The Android <span className="text-sky-300 font-semibold">DuplicateFrameFilter</span> locks onto accepted spins and suppresses repeated frame reads until the next spin transition.
            </p>
          </div>

          {/* Real-time Log Stream */}
          <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1 font-mono text-[10px]">
            {filterLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-600 italic">
                Awaiting frame inputs from OCR scanner...
              </div>
            ) : (
              filterLogs.slice(0, 7).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-2 rounded bg-slate-900/90 p-1.5 border border-slate-800/80"
                >
                  <div className="truncate">
                    <span className="text-slate-500 mr-1">
                      {new Date(log.timestamp).toLocaleTimeString().slice(3, 8)}
                    </span>
                    <span className="font-bold text-slate-200 mr-1.5">
                      #{log.detectedNumber}
                    </span>
                    <span className="text-slate-400">{log.message}</span>
                  </div>
                  <div className="shrink-0">{getLogBadge(log.status)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
