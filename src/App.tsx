import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Smartphone,
  Eye,
  FileCode2,
  BookOpen,
  Activity,
  Layers,
  Sparkles,
  ShieldAlert,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Radio,
  ExternalLink,
} from 'lucide-react';
import {
  RouletteNumberItem,
  PredictionState,
  FilterLog,
} from './types';
import {
  createRouletteNumber,
  evaluatePredictions,
  DuplicateFilterEngine,
} from './utils/rouletteEngine';
import { FloatingHudOverlay } from './components/FloatingHudOverlay';
import { LiveStreamSimulator } from './components/LiveStreamSimulator';
import { RouletteTableInput } from './components/RouletteTableInput';
import { AndroidCodeHub } from './components/AndroidCodeHub';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'docs'>('simulator');
  const [showHudOverlay, setShowHudOverlay] = useState(true);

  // Engine state
  const [history, setHistory] = useState<RouletteNumberItem[]>([
    createRouletteNumber(32),
    createRouletteNumber(15),
    createRouletteNumber(19),
    createRouletteNumber(4),
  ]);
  const [zeroPauseActive, setZeroPauseActive] = useState<boolean>(false);
  const [filterLogs, setFilterLogs] = useState<FilterLog[]>([]);
  const [fps, setFps] = useState<number>(3.8);

  const filterEngineRef = useRef<DuplicateFilterEngine>(new DuplicateFilterEngine(7000, 2));

  // Compute prediction dynamically
  const { prediction } = evaluatePredictions(history, zeroPauseActive);

  // Handle addition of a verified roulette number
  const addVerifiedNumber = useCallback(
    (num: number) => {
      const item = createRouletteNumber(num);
      setHistory((prev) => {
        const nextList = [item, ...prev];
        return nextList.slice(0, 50); // Keep last 50 spins
      });

      if (num === 0) {
        setZeroPauseActive(true);
      } else if (zeroPauseActive) {
        setZeroPauseActive(false); // 1-spin pause expired
      }
    },
    [zeroPauseActive]
  );

  // Handle simulated OCR video frame input (tests duplicate frame suppression)
  const handleFeedOcrFrame = useCallback(
    (detectedNumber: number) => {
      const result = filterEngineRef.current.processFrame(detectedNumber);

      const newLog: FilterLog = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        detectedNumber,
        status: result.status,
        message: result.message,
      };

      setFilterLogs((prev) => [newLog, ...prev.slice(0, 30)]);

      // If accepted as a confirmed new spin
      if (result.status === 'ACCEPTED_NEW_SPIN' && result.confirmedNumber !== null) {
        addVerifiedNumber(result.confirmedNumber);
      }
    },
    [addVerifiedNumber]
  );

  // Manual direct add (bypasses dedup for test bench)
  const handleManualAdd = (num: number) => {
    addVerifiedNumber(num);
    const newLog: FilterLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      detectedNumber: num,
      status: 'ACCEPTED_NEW_SPIN',
      message: `Manual user override: Added #${num}`,
    };
    setFilterLogs((prev) => [newLog, ...prev.slice(0, 30)]);
  };

  // Run preset pattern benchmark sequence
  const handleRunPreset = (numbers: number[], patternName: string) => {
    // Reset and sequentially load preset
    filterEngineRef.current.reset();
    const items = [...numbers].reverse().map((n) => createRouletteNumber(n));
    setHistory(items);
    setZeroPauseActive(numbers.includes(0));

    const newLog: FilterLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      detectedNumber: numbers[numbers.length - 1],
      status: 'ACCEPTED_NEW_SPIN',
      message: `Loaded benchmark preset: ${patternName} [${numbers.join(', ')}]`,
    };
    setFilterLogs((prev) => [newLog, ...prev.slice(0, 30)]);
  };

  const handleResetHistory = () => {
    setHistory([]);
    setZeroPauseActive(false);
    filterEngineRef.current.reset();
    setFilterLogs([]);
  };

  // Slight natural FPS jitter simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setFps(3.4 + Math.random() * 0.8);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white font-sans antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 shadow-md shadow-emerald-500/20">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white sm:text-lg">
                  Roulette OCR Predictor
                </h1>
                <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300 ring-1 ring-sky-500/40">
                  Android Kotlin Native
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                MediaProjection Screen Capture &bull; ML Kit Latin OCR &bull; Floating WindowManager HUD
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                onClick={() => setActiveTab('simulator')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'simulator'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Live Simulator &amp; HUD</span>
                <span className="sm:hidden">Sim</span>
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'code'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Android Source Code</span>
                <span className="sm:hidden">Code</span>
              </button>

              <button
                onClick={() => setActiveTab('docs')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'docs'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Pattern Specs</span>
                <span className="sm:hidden">Specs</span>
              </button>
            </div>

            {/* Toggle Floating Overlay Visibility */}
            <button
              onClick={() => setShowHudOverlay(!showHudOverlay)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                showHudOverlay
                  ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle interactive draggable floating HUD"
            >
              <Radio className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden md:inline">
                {showHudOverlay ? 'HUD Visible' : 'Show HUD'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* TAB 1: Live Simulator & HUD */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            {/* Quick Architecture Badges Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-3 border border-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-slate-200">MediaProjection</div>
                  <div className="text-[10px] text-slate-400">Foreground Service Type</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-3 border border-slate-800">
                <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-slate-200">Google ML Kit OCR</div>
                  <div className="text-[10px] text-slate-400">Latin TextRecognizer (0-36)</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-3 border border-slate-800">
                <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-slate-200">System Alert Window</div>
                  <div className="text-[10px] text-slate-400">Interactive Floating HUD</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-3 border border-slate-800">
                <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-slate-200">Continuous Dedup</div>
                  <div className="text-[10px] text-slate-400">7s Cooldown &amp; State Lock</div>
                </div>
              </div>
            </div>

            {/* Video Stream & OCR Simulator */}
            <LiveStreamSimulator
              onFeedOcrFrame={handleFeedOcrFrame}
              latestNumber={history[0] || null}
              filterLogs={filterLogs}
            />

            {/* European Roulette Interactive Board & Preset Pattern Tests */}
            <RouletteTableInput
              onAddNumber={handleManualAdd}
              onRunPreset={handleRunPreset}
              onClear={handleResetHistory}
            />
          </div>
        )}

        {/* TAB 2: Android Native Source Code Hub */}
        {activeTab === 'code' && <AndroidCodeHub />}

        {/* TAB 3: Pattern Specs & Zero Pause Logic */}
        {activeTab === 'docs' && (
          <div className="rounded-2xl bg-slate-900/80 p-6 ring-1 ring-slate-800 backdrop-blur-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-sky-400" />
                Right-to-Left (RTL) Pattern Recognition &amp; Zero Handling Engine
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Algorithmic specifications for sequence evaluation from newest outcome ($t_0$) backwards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Zig-Zag */}
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
                <h4 className="font-bold text-sky-400 text-sm flex items-center gap-1.5">
                  1. Zig-Zag (Alternating Sequence)
                </h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Detects alternating color oscillations: Red &rarr; Black &rarr; Red &rarr; Black.
                  When streak length $\ge 3$, predicts wave continuation (if current is Red, predict Black) with scaled confidence between 70% and 92%.
                </p>
              </div>

              {/* Bracket */}
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
                <h4 className="font-bold text-purple-400 text-sm flex items-center gap-1.5">
                  2. Bracket (A-B-B-A Sandwich)
                </h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Recognizes symmetric sandwich structures. When history exhibits $[A \rightarrow B \rightarrow B]$, the pattern engine detects the open bracket and signals a bet on outer bracket closure $A$.
                </p>
              </div>

              {/* Color Flow */}
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
                <h4 className="font-bold text-red-400 text-sm flex items-center gap-1.5">
                  3. Color Flow (Streak Momentum)
                </h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Triggered when 3 or more consecutive spins land on the same color. Exploits casino wheel momentum and dealer physical signature runs. Alerts when streaks extend past 5 spins.
                </p>
              </div>

              {/* False Break */}
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
                <h4 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                  4. False Break (Snapback Reversal)
                </h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Occurs when a dominant 3x streak is temporarily interrupted by a single opposite color, e.g. $[R, R, R, B]$. Predicts an immediate snapback reversal to the dominant color Red.
                </p>
              </div>

              {/* 1-2-3 Progression */}
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
                <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                  5. 1-2-3 Progression
                </h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Evaluates harmonic progression of counts: 1 of $A$, 2 of $B$, followed by $A$. When $[A \rightarrow 2B \rightarrow 2A]$ is formed, predicts the 3rd $A$ to complete the 1-2-3 pattern.
                </p>
              </div>

              {/* Group March */}
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
                <h4 className="font-bold text-blue-400 text-sm flex items-center gap-1.5">
                  6. Group March (Dozens &amp; Columns)
                </h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Tracks table sector rotation: 1st Dozen &rarr; 2nd Dozen &rarr; 3rd Dozen. When a complete march sequence completes, signals a cycle reset back to 1st Dozen.
                </p>
              </div>

              {/* 2*2 Pattern */}
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
                <h4 className="font-bold text-cyan-400 text-sm flex items-center gap-1.5">
                  7. 2*2 Pair Flow
                </h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Frequent wheel rhythm where colors alternate in pairs: 2 Red &rarr; 2 Black. Once the 2nd Black lands, predicts immediate switch to Red to launch the next 2-pair.
                </p>
              </div>

              {/* Zero (0) Pause */}
              <div className="rounded-xl bg-slate-950 p-4 border border-emerald-800/80 bg-emerald-950/20">
                <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  Zero (0) Green Handling (1-Spin Pause)
                </h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Zero represents the house edge. When 0 hits, the system automatically sets <code className="text-emerald-300 font-bold">isZeroPaused = true</code>, emits a bold HUD alert banner, and issues a strict <strong>NO BET</strong> command for 1 spin until a new outcome establishes a clean baseline.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating System Alert Window HUD Overlay */}
      {showHudOverlay && (
        <FloatingHudOverlay
          prediction={prediction}
          history={history}
          latestNumber={history[0] || null}
          fps={fps}
          latestFilterLog={filterLogs[0] || null}
          onReset={handleResetHistory}
          onManualAdd={handleManualAdd}
        />
      )}
    </div>
  );
}
