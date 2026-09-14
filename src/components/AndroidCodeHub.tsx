import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  FileCode,
  Smartphone,
  Cpu,
  ShieldCheck,
  ExternalLink,
  FolderTree,
} from 'lucide-react';
import JSZip from 'jszip';
import { ANDROID_FILES } from '../data/androidFiles';
import { AndroidCodeFile } from '../types';

export const AndroidCodeHub: React.FC = () => {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const currentFile = ANDROID_FILES[selectedFileIndex];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Top-level gradle files
      zip.file(
        'build.gradle.kts',
        `// Top-level build file
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
}`
      );

      zip.file(
        'settings.gradle.kts',
        `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "RouletteOCRPredictor"
include(":app")`
      );

      zip.file(
        'README.md',
        `# Automatic Roulette OCR Predictor (Native Android Kotlin)

Real-time casino stream OCR screen reader and floating overlay HUD predictor.

## Features
- **MediaProjection Foreground Service**: Captures casino screen in real-time.
- **Google ML Kit Text Recognition**: On-device Latin OCR reading numbers 0-36.
- **Continuous Duplicate Frame Filtering**: Prevents repeating frames of the same spin banner.
- **System Alert Window Floating Overlay**: Interactive draggable HUD.
- **7-Pattern Right-to-Left Logic**: Zig-Zag, Bracket, Color Flow, False Break, 1-2-3, Group March, 2*2.
- **Zero (0) Green Handling**: Automatic 1-spin pause cooldown.

## How to Run in Android Studio
1. Open Android Studio (Hedgehog / Iguana / Ladybug or newer).
2. Select **Open** and choose this project folder.
3. Sync Gradle and build app.
4. Run on a physical Android device (API 26+).
5. Grant **Display Over Other Apps** and **Screen Recording** permissions when prompted.
`
      );

      // Add all app files
      ANDROID_FILES.forEach((f) => {
        zip.file(f.path, f.code);
      });

      // Generate zip blob
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'RouletteOCRPredictor-Android-Kotlin.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to generate zip', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 p-5 ring-1 ring-slate-800 backdrop-blur-sm space-y-5">
      {/* Header & Download Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-400" />
            Complete Native Android Kotlin Source Code
          </h3>
          <p className="text-xs text-slate-400">
            Production-grade MediaProjection foreground service, ML Kit OCR, Floating WindowManager HUD, and RTL pattern analyzer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400" />
                <span>Copy Current File</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isZipping ? 'Generating Zip...' : 'Download Android Project (.zip)'}</span>
          </button>
        </div>
      </div>

      {/* File Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800/80 pb-2">
        {ANDROID_FILES.map((file, idx) => (
          <button
            key={file.name}
            onClick={() => setSelectedFileIndex(idx)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectedFileIndex === idx
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50'
                : 'bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <FileCode className="h-3.5 w-3.5 text-sky-400" />
            <span>{file.name}</span>
          </button>
        ))}
      </div>

      {/* Selected File Description & Path */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/60 px-3.5 py-2 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-400 text-[11px]">
            Path: <span className="text-slate-200 font-semibold">{currentFile.path}</span>
          </span>
        </div>
        <div className="text-[11px] text-slate-400 italic">
          {currentFile.description}
        </div>
      </div>

      {/* Code Viewer */}
      <div className="relative overflow-hidden rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-mono text-slate-400">
          <span>{currentFile.name}</span>
          <span className="uppercase text-[10px] text-slate-500 font-bold">
            {currentFile.language}
          </span>
        </div>

        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-300 max-h-[480px] scrollbar-thin scrollbar-thumb-slate-700">
          <code>{currentFile.code}</code>
        </pre>
      </div>

      {/* Architectural Explanations for Key Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800">
          <div className="flex items-center gap-2 font-bold text-xs text-sky-400 mb-1">
            <Cpu className="h-4 w-4" />
            1. MediaProjection &amp; ML Kit
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Starting in Android 14 (API 34), foreground services must declare <code className="text-sky-300">android:foregroundServiceType="mediaProjection"</code>.
            Image frames from <code className="text-sky-300">ImageReader</code> are cropped to the casino banner ROI and passed to Google ML Kit Latin TextRecognizer.
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800">
          <div className="flex items-center gap-2 font-bold text-xs text-emerald-400 mb-1">
            <ShieldCheck className="h-4 w-4" />
            2. Continuous Duplicate Filter
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Casino video streams hold winning numbers on-screen for 15+ seconds. The <code className="text-emerald-300">DuplicateFrameFilter</code> implements state-locking and a 7-second refractory cooldown with 2-frame debouncing to eliminate duplicate spin records.
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800">
          <div className="flex items-center gap-2 font-bold text-xs text-purple-400 mb-1">
            <Smartphone className="h-4 w-4" />
            3. WindowManager Overlay HUD
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Inflates <code className="text-purple-300">overlay_layout.xml</code> as <code className="text-purple-300">TYPE_APPLICATION_OVERLAY</code>.
            Touch listener tracks raw touch deltas for smooth dragging. Dynamically updates with Right-to-Left (RTL) spin history and zero pause banners.
          </p>
        </div>
      </div>
    </div>
  );
};
